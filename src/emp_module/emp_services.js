import prisma from "../../db/db.config.js";
import * as XLSX from "xlsx";
import bcrypt from "bcrypt";


export async function getAllEmployees() {
  return prisma.employee.findMany({
    where: {status: {
    in: ["ACTIVE", "EXITED"]
  }} ,
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          gender: true
        }
      },
      team: {
        select: {
          id: true,
          name: true
        }
      },
      designation: {
        select: {
          id: true,
          name: true
        }
      },
      manager: {
        include: {
          user: {
            select: {
              fullName: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

/*
  ===============================
  CONFIGURATION CONSTANTS
  ===============================
*/

const MASTER_SHEET_NAME = ["master data", "master database"];
const DEFAULT_TEAM_NAME = "General";
const DEFAULT_ROLE_CODE = "EMPLOYEE";

const DEFAULT_PASSWORD = "Welcome@123";
const SALT_ROUNDS = 10;

/*
  Batch size for parallel processing.

  Example:
  If Excel has 1000 rows and batch size = 20

  → 20 employees processed in parallel
  → prevents DB overload
*/
const BATCH_SIZE = 20;

/*
  ===============================
  HELPER FUNCTIONS
  ===============================
*/

/*
  Convert any Excel value into a clean string.

  Handles:
  - null
  - undefined
  - NaN
  - empty strings
*/
function toStr(val) {
  if (val === null || val === undefined) return null;

  const s = String(val).trim();

  if (!s || s.toLowerCase() === "nan") return null;

  return s;
}

/*
  Parse Excel dates safely.

  Excel sometimes sends:
  - Date objects
  - Serial numbers
  - Strings
*/
function parseDate(val) {

  if (!val) return null;

  if (val instanceof Date) return val;

  if (typeof val === "number") {
    // Excel serial date conversion
    return new Date((val - 25569) * 86400 * 1000);
  }

  const d = new Date(val);

  return isNaN(d.getTime()) ? null : d;
}

/*
  Normalize mobile numbers.

  Removes spaces and special characters.
*/
function normalizeMobile(val) {

  const s = toStr(val);

  if (!s) return null;

  return s.replace(/\D/g, "").slice(-10);
}

/*
  Normalize Aadhaar number.
*/
function normalizeAadhar(val) {

  const s = toStr(val);

  if (!s) return null;

  return s.replace(/\s+/g, "");
}

/*
  Convert YES/NO type values to boolean.
*/
function parseBoolean(val) {

  if (!val) return false;

  const v = String(val).trim().toLowerCase();

  return ["yes", "y", "true", "1"].includes(v);
}

/*
  Generate username.

  Priority:
  1. Employee code
  2. Full name
*/
function generateUsername(empCode, fullName) {

  if (empCode) {
    return `EMP${empCode}`;
  }

  return fullName
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "")
    .slice(0, 30);
}

/*
  Derive employee status using resign date.
*/
function deriveStatus(resignDate) {

  if (!resignDate) return "ACTIVE";

  return resignDate <= new Date()
    ? "EXITED"
    : "ACTIVE";
}

/*
  Find correct sheet inside workbook.
*/
function findSheet(workbook) {

  const name = workbook.SheetNames.find(name =>
  MASTER_SHEET_NAME.includes(name.toLowerCase())
);


  if (!name) {
    throw new Error(`Sheet "${MASTER_SHEET_NAME}" not found`);
  }

  return workbook.Sheets[name];
}

function findHeaderRow(rawRows) {

  const HEADER_KEYWORDS = [
    "emp id",
    "employee id",
    "emp_id"
  ];

  for (let i = 0; i < rawRows.length; i++) {

    const row = rawRows[i].map(v => String(v).toLowerCase().trim());

    const found = HEADER_KEYWORDS.some(keyword =>
      row.includes(keyword)
    );

    if (found) {
      return i;
    }
  }

  throw new Error("Header row not found in Excel");
}

/*
  Convert sheet → JSON rows
*/
function normalizeHeader(header) {
  return String(header)
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADER_MAP = {
  emp_id: ["emp id", "employee id"],
  full_name: ["full name", "name of the consultant"],
  father_name: ["father's name"],
  husband_or_wife_name: ["husband / wife's name", "husband / wife name"],
  dob: ["dob", "d o b"],
  doj: ["doj", "d o j"],
  resign_date: ["resign/terminate", "resign/ terminate"],
  designation: ["designation"],
  epf_number: ["epf number"],
  uan_number: ["uan number"],
  esic_number: ["esic number"],
  aadhar_number: ["aadhar number", "aadhaar number"],
  pan_number: ["pan number"],
  bank_ac_number: ["bank ac number"],
  ifsc_code: ["ifsc code"],
  address: ["residential address"],
  mobile: ["mobile number", "mobile no"],
  kin_name: ["next to kin name"],
  kin_relation: ["relationship"],
  kin_mobile: ["next to kin mob num"],
  email: ["email id", "email"],
  qualification: ["qualification"],
  experience: ["experience"],
  insurance_taken: ["insurance taken"],
  insurance_validity: ["insurance validity"]
};

function buildHeaderIndexMap(headerRow) {
  const map = {};

  headerRow.forEach((col, index) => {
    const normalized = normalizeHeader(col);

    for (const key in HEADER_MAP) {
      const aliases = HEADER_MAP[key];

      if (aliases.some(alias => normalized.includes(alias))) {
        map[key] = index;
      }
    }
  });

  return map;
}

function parseRows(sheet) {
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  const headerRowIndex = findHeaderRow(rawRows);

  const headerRow = rawRows[headerRowIndex];

  const headerIndexMap = buildHeaderIndexMap(headerRow);

  // ✅ REQUIRED FIELDS
  const REQUIRED_FIELDS = ["emp_id", "full_name", "designation"];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in headerIndexMap)) {
      throw new Error(`Missing required column: ${field}`);
    }
  }

  const dataRows = rawRows.slice(headerRowIndex + 1);

  return dataRows.map(row => ({

    emp_id: row[headerIndexMap.emp_id],
    full_name: row[headerIndexMap.full_name],
    father_name: row[headerIndexMap.father_name],
    husband_or_wife_name: row[headerIndexMap.husband_or_wife_name],

    dob: row[headerIndexMap.dob],
    doj: row[headerIndexMap.doj],
    resign_date: row[headerIndexMap.resign_date],

    designation: row[headerIndexMap.designation],

    epf_number: row[headerIndexMap.epf_number],
    uan_number: row[headerIndexMap.uan_number],
    esic_number: row[headerIndexMap.esic_number],

    aadhar_number: row[headerIndexMap.aadhar_number],
    pan_number: row[headerIndexMap.pan_number],

    bank_ac_number: row[headerIndexMap.bank_ac_number],
    ifsc_code: row[headerIndexMap.ifsc_code],

    address: row[headerIndexMap.address],
    mobile: row[headerIndexMap.mobile],

    kin_name: row[headerIndexMap.kin_name],
    kin_relation: row[headerIndexMap.kin_relation],
    kin_mobile: row[headerIndexMap.kin_mobile],

    email: row[headerIndexMap.email],

    qualification: row[headerIndexMap.qualification],
    experience: row[headerIndexMap.experience],

    insurance_taken: row[headerIndexMap.insurance_taken],
    insurance_validity: row[headerIndexMap.insurance_validity]

  }))
  .filter(r => r.emp_id);
}

export async function processBulkUpload(fileBuffer, options = {}) {
  const adminId = options.adminId || null
  const dryRun = options.dryRun || false

  /*
    ===============================
    STEP 1 — READ EXCEL FILE
    ===============================
  */

  const workbook = XLSX.read(fileBuffer, {
    type: "buffer",
    cellDates: true
  });

  const sheet = findSheet(workbook);

  const rows = parseRows(sheet);

  if (!rows.length) {
    throw new Error("No employee rows found in Excel");
  }

  /*
    ===============================full_name
    STEP 2 — PRELOAD REFERENCE DATA
    ===============================
  */

    console.log(rows, "sheet check")
  const [defaultTeam, employeeRole] = await Promise.all([

    prisma.team.upsert({
      where: { name: DEFAULT_TEAM_NAME },
      update: {},
      create: { name: DEFAULT_TEAM_NAME }
    }),

    prisma.role.upsert({
      where: { code: DEFAULT_ROLE_CODE },
      update: {},
      create: { code: DEFAULT_ROLE_CODE, name: "Employee" }
    })
  ]);

  /*
    Collect unique designation names
  */
  const designationNames = [
    ...new Set(
      rows
        .map(r => toStr(r.designation))
        .filter(Boolean)
    )
  ];

  /*
    Ensure designations exist
  */
  await Promise.all(
    designationNames.map(name =>
      prisma.designation.upsert({
        where: { name },
        update: {},
        create: { name }
      })
    )
  );

  /*
    Build designation map

    Example:
    {
      Manager: 1,
      Developer: 2
    }
  */
  const designationMap = Object.fromEntries(

    (await prisma.designation.findMany({
      where: { name: { in: designationNames } }
    })).map(d => [d.name, d.id])

  );
  
  
  /*
    Preload existing emails to avoid N+1 queries
  */

  const emails = rows.map(r => toStr(r.email)).filter(Boolean);

  const existingUsers = await prisma.user.findMany({
    where: {
      email: { in: emails }
    },
    select: { email: true }
  });

  const emailSet = new Set(existingUsers.map(u => u.email.toLowerCase()));

    const seenEmails = new Set();
    const duplicateEmailsInFile = new Set();

    rows.forEach(r => {
      const email = toStr(r.email);
      if (!email) return;

      if (seenEmails.has(email)) {
        duplicateEmailsInFile.add(email);
      } else {
        seenEmails.add(email);
      }
  });

  /*
    Preload existing employees to avoid N+1 queries
  */

  const empCodes = rows.map(r => String(r.emp_id));

  const existingEmployees = await prisma.employee.findMany({
    where: {
      empCode: { in: empCodes }
    }
  });

  const employeeMap = Object.fromEntries(
    existingEmployees.map(e => [e.empCode, e])
  );

  /*
    Pre-hash password once

    Avoid hashing repeatedly
  */
  const passwordHash = await bcrypt.hash(
    DEFAULT_PASSWORD,
    SALT_ROUNDS
  );

  /*
    Result tracking
  */
  const results = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,

    previewCreated: 0,
    previewUpdated: 0,

    errors: []
  }
  /*
    ===============================
    STEP 3 — BATCH PROCESSING
    ===============================
  */

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {

    const batch = rows.slice(i, i + BATCH_SIZE);

    await Promise.all(

      batch.map(async (row) => {

        try {

          const empCode = toStr(row.emp_id);
          const fullName = toStr(row.full_name);

          const designationName = toStr(row.designation);

          if (!fullName || !designationName) {
            throw new Error("Missing name or designation");
          }

          const designationId = designationMap[designationName];

          const username = generateUsername(empCode, fullName);

          const rawEmail = toStr(row.email);

          const email = rawEmail ? rawEmail.toLowerCase() : `${username}_${empCode}@company.internal`;

          const doj = parseDate(row.doj);

          const resignDate = parseDate(row.resign_date);

          const status = deriveStatus(resignDate);

          const personalDetail = {
            dateOfBirth: parseDate(row.dob),
            fatherName: toStr(row.father_name),
            spouseName: toStr(row.husband_or_wife_name),
            mobileNumber: normalizeMobile(row.mobile),
            address: toStr(row.address)
          };

          const document = {
            aadharNumber: normalizeAadhar(row.aadhar_number),
            panNumber: toStr(row.pan_number),
            uanNumber: toStr(row.uan_number),
            epfNumber: toStr(row.epf_number),
            esicNumber: toStr(row.esic_number)
          };

          const bankDetail = {
            bankAccountNumber: toStr(row.bank_ac_number),
            ifscCode: toStr(row.ifsc_code)
          };

          const emergencyContact = {
            name: toStr(row.kin_name),
            relationship: toStr(row.kin_relation),
            mobileNumber: normalizeMobile(row.kin_mobile)
          };

          const professionalDetail = {
            qualification: toStr(row.qualification),
            experience: toStr(row.experience),
            insuranceTaken: parseBoolean(row.insurance_taken),
            insuranceValidity: toStr(row.insurance_validity)
          };

        const existing = employeeMap[empCode];

        // ==============================
        // EMAIL VALIDATION
        // ==============================

        if (email) {

          // Duplicate inside file
          if (duplicateEmailsInFile.has(email)) {
            throw new Error("Duplicate email in file");
          }

          const existing = employeeMap[empCode];

          if (existing) {
            // Updating employee → allow same email
            const existingUser = await prisma.user.findUnique({
              where: { id: existing.userId },
              select: { email: true }
            });

            const isSameEmail =
              existingUser?.email?.toLowerCase() === email;

            if (!isSameEmail && emailSet.has(email)) {
              throw new Error("Email already used by another user");
            }

          } else {
            // New employee → block if exists
            if (emailSet.has(email)) {
              throw new Error("Email already exists in system");
            }
          }
        }

         if (dryRun) {
            if (existing) {
              results.previewUpdated++
            } else {
              results.previewCreated++
            }

            return
          }
          
          /*
            UPDATE EXISTING EMPLOYEE
          */
          if (existing) {

            await prisma.$transaction([

              prisma.user.update({
                where: { id: existing.userId },
                data: { fullName, email }
              }),

              prisma.employee.update({
                where: { empCode },
                data: {
                  designationId,
                  status,
                  dateOfJoining: doj,
                  resignDate
                }
              }),

              prisma.employeePersonalDetail.upsert({
                where: { employeeId: existing.id },
                update: personalDetail,
                create: {
                  employeeId: existing.id,
                  ...personalDetail
                }
              }),

              prisma.employeeDocument.upsert({
                where: { employeeId: existing.id },
                update: document,
                create: {
                  employeeId: existing.id,
                  ...document
                }
              }),

              prisma.employeeBankDetail.upsert({
                where: { employeeId: existing.id },
                update: bankDetail,
                create: {
                  employeeId: existing.id,
                  ...bankDetail
                }
              }),

              prisma.employeeEmergencyContact.upsert({
                where: { employeeId: existing.id },
                update: emergencyContact,
                create: {
                  employeeId: existing.id,
                  ...emergencyContact
                }
              }),

              prisma.employeeProfessionalDetail.upsert({
                where: { employeeId: existing.id },
                update: professionalDetail,
                create: {
                  employeeId: existing.id,
                  ...professionalDetail
                }
              }),

              prisma.auditLog.create({
                data: {
                  entity: "EMPLOYEE",
                  entityId: existing.id,
                  action: "BULK_UPLOAD_UPDATE",
                  performedById: adminId,
                  changes: {
                    empCode,
                    designation: designationName
                  }
                }
              }),

            ]);

            results.updated++;

          } else {

            /*
              CREATE NEW EMPLOYEE
            */

            await prisma.$transaction(async (tx) => {

              const user = await tx.user.create({

                data: {
                  username,
                  fullName,
                  email,
                  passwordHash,
                  status: "ACTIVE",
                  isActive: true,
                  isFirstLogin: true
                }

              });

              const employee = await tx.employee.create({

                data: {
                  userId: user.id,
                  empCode,
                  designationId,
                  teamId: defaultTeam.id,
                  status,
                  dateOfJoining: doj,
                  resignDate
                }

              });

              await Promise.all([

                tx.userRole.create({
                  data: {
                    userId: user.id,
                    roleId: employeeRole.id
                  }
                }),

                tx.leaveBalance.create({
                  data: {
                    employeeId: employee.id,
                    year: new Date().getFullYear()
                  }
                }),

                tx.employeePersonalDetail.create({
                  data: { employeeId: employee.id, ...personalDetail }
                }),

                tx.employeeDocument.create({
                  data: { employeeId: employee.id, ...document }
                }),

                tx.employeeBankDetail.create({
                  data: { employeeId: employee.id, ...bankDetail }
                }),

                tx.employeeEmergencyContact.create({
                  data: { employeeId: employee.id, ...emergencyContact }
                }),

                tx.employeeProfessionalDetail.create({
                  data: { employeeId: employee.id, ...professionalDetail }
                }),

                tx.auditLog.create({
                  data: {
                    entity: "EMPLOYEE",
                    entityId: employee.id,
                    action: "BULK_UPLOAD_CREATE",
                    performedById: adminId,
                    changes: {
                      empCode,
                      designation: designationName
                    }
                  }
                })
              ]);

            });

            results.created++;

          }

        } catch (err) {

          results.skipped++;

          results.errors.push({
            empCode: row.emp_id,
            reason: err.message
          });

        }

      })

    );

  }
  console.log(results, "results")
  return results;
}