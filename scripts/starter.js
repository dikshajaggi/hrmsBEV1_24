import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

let empCounter = 1001;

async function main() {
  console.log("🌱 Seeding database...");

  // ==============================
  // ROLES
  // ==============================
  await prisma.role.createMany({
    data: [
      { code: "HR", name: "HR" },
      { code: "MANAGER", name: "Manager" },
      { code: "EMPLOYEE", name: "Employee" }
    ],
    skipDuplicates: true
  });

  // ==============================
  // TEAMS
  // ==============================
  await prisma.team.createMany({
    data: ["HR", "AI", "Finance", "Design"].map(name => ({ name })),
    skipDuplicates: true
  });

  // ==============================
  // DESIGNATIONS
  // ==============================
  await prisma.designation.createMany({
    data: [
      "Assistant Vice President",
      "DGM HR and Finance",
      "Assistant Design Engineer",
      "Assistant Finance Manager",
      "Employee",
      "Software Developer",
      "UI/UX Designer",
      "AI/ML Engineer",
      "Backend Engineer",
      "Data Pipeline Engineer"
    ].map(name => ({ name })),
    skipDuplicates: true
  });

  // ==============================
  // LEAVE TYPES
  // ==============================
  await prisma.leaveType.createMany({
    data: [
      { code: "CL", name: "Casual Leave" },
      { code: "SL", name: "Sick Leave" },
      { code: "PL", name: "Privilege Leave" }
    ],
    skipDuplicates: true
  });

  // ==============================
  // WEEKLY OFF RULE
  // ==============================
  await prisma.weeklyOffRule.upsert({
    where: { dayOfWeek: 6 },
    update: {},
    create: {
      dayOfWeek: 6,
      weekNumbers: [2, 4]
    }
  });

  // ==============================
  // HOLIDAYS
  // ==============================
  const holidays = [
    "2026-01-26",
    "2026-03-04",
    "2026-03-26",
    "2026-03-31",
    "2026-04-03",
    "2026-08-15",
    "2026-10-02",
    "2026-12-25"
  ].map(date => ({
    date: new Date(date),
    name: new Date(date).toDateString()
  }));

  await prisma.holiday.createMany({
    data: holidays,
    skipDuplicates: true
  });

  // ==============================
  // FETCH IDS
  // ==============================
  const teams = await prisma.team.findMany();
  const designations = await prisma.designation.findMany();
  const roles = await prisma.role.findMany();

  const getTeam = name => teams.find(t => t.name === name)?.id;
  const getDesg = name => designations.find(d => d.name === name)?.id;
  const getRole = code => roles.find(r => r.code === code)?.id;

  const DEFAULT_PASSWORD = "Password@123";
  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // ==============================
  // USERS
  // ==============================
  const usersData = [
    ["mona","Mona Savio Pereira","mona@company.com","HR","HR","DGM HR and Finance"],
    ["niladri","Niladri Bose","niladri@company.com","MANAGER","AI","Assistant Vice President"],
    ["diksha","Diksha Jaggi","diksha@company.com","EMPLOYEE","AI","Software Developer"],
    ["uttam","Uttam Rana","uttam@company.com","EMPLOYEE","AI","Software Developer"]
  ];

  const createdUsers = [];

  for (const [username, fullName, email, role, team, desg] of usersData) {

    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        username,
        fullName,
        email,
        passwordHash: hashedPassword,
        status: "ACTIVE",
        isActive: true
      }
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: getRole(role)
        }
      },
      update: {},
      create: {
        userId: user.id,
        roleId: getRole(role)
      }
    });

    const employee = await prisma.employee.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        empCode: String(empCounter++),
        teamId: getTeam(team),
        designationId: getDesg(desg)
      }
    });

    await prisma.leaveBalance.upsert({
      where: {
        employeeId_year: {
          employeeId: employee.id,
          year: 2026
        }
      },
      update: {},
      create: {
        employeeId: employee.id,
        year: 2026
      }
    });

    createdUsers.push({ user, employee, role });
  }

  // ==============================
  // ATTENDANCE (FEB 2026)
  // ==============================
  const employees = await prisma.employee.findMany();
  const holidayDates = holidays.map(h => h.date.toISOString().split("T")[0]);

  const attendanceData = [];

  for (let d = new Date("2026-02-01"); d <= new Date("2026-02-28"); d.setDate(d.getDate() + 1)) {

    const date = new Date(d);
    const iso = date.toISOString().split("T")[0];
    const day = date.getDay();
    const week = Math.ceil(date.getDate() / 7);

    for (const emp of employees) {

      let status = "PRESENT";

      if (holidayDates.includes(iso)) status = "HOLIDAY";
      else if (day === 0) status = "WEEKLY_OFF";
      else if (day === 6 && [2,4].includes(week)) status = "WEEKLY_OFF";
      else {
        const arr = ["PRESENT","WFH","LEAVE_FULL","SICK_FULL"];
        status = arr[Math.floor(Math.random() * arr.length)];
      }

      attendanceData.push({
        employeeId: emp.id,
        date,
        status,
        markedById: createdUsers[0].user.id
      });
    }
  }

  await prisma.attendance.createMany({
    data: attendanceData,
    skipDuplicates: true
  });

  console.log("✅ Seed completed successfully");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());