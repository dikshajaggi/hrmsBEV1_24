import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {

  console.log("🌱 Seeding database...");

  // ==============================
  // ROLES
  // ==============================

  const roles = await prisma.role.createMany({
    data: [
      { code: "ADMIN", name: "Admin" },
      { code: "MANAGER", name: "Manager" },
      { code: "EMPLOYEE", name: "Employee" }
    ],
    skipDuplicates: true
  });

  // ==============================
  // TEAMS
  // ==============================

  await prisma.team.createMany({
    data: [
      { name: "HR" },
      { name: "AI" },
      { name: "Finance" },
      { name: "Design" }
    ],
    skipDuplicates: true
  });

  // ==============================
  // DESIGNATIONS
  // ==============================

  await prisma.designation.createMany({
    data: [
      { name: "Assistant Vice President" },
      { name: "DGM HR and Finance" },
      { name: "Assistant Design Engineer" },
      { name: "Assistant Finance Manager" },
      { name: "Employee" },
      { name: "Software Developer" },
      { name: "UI/UX Designer" },
      { name: "AI/ML Engineer" },
      { name: "Backend Engineer" },
      { name: "Data Pipeline Engineer" }
    ],
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

  await prisma.weeklyOffRule.create({
    data: {
      dayOfWeek: 6, // Saturday
      weekNumbers: [2, 4]
    }
  });

  // ==============================
  // HOLIDAYS
  // ==============================

  const holidays = [
    { date: new Date("2026-01-26"), name: "Republic Day" },
    { date: new Date("2026-03-04"), name: "Holi" },
    { date: new Date("2026-03-26"), name: "Ram Navmi" },
    { date: new Date("2026-03-31"), name: "Mahavir Jayanti" },
    { date: new Date("2026-04-03"), name: "Good Friday" },
    { date: new Date("2026-08-15"), name: "Independence Day" },
    { date: new Date("2026-10-02"), name: "Gandhi Jayanti" },
    { date: new Date("2026-12-25"), name: "Christmas" }
  ];

  for (const holiday of holidays) {
    await prisma.holiday.create({ data: holiday });
  }

  // ==============================
  // FETCH IDS
  // ==============================

  const teams = await prisma.team.findMany();
  const designations = await prisma.designation.findMany();
  const rolesData = await prisma.role.findMany();

  const getTeam = name => teams.find(t => t.name === name).id;
  const getDesg = name => designations.find(d => d.name === name).id;
  const getRole = code => rolesData.find(r => r.code === code).id;

  // ==============================
  // USERS
  // ==============================

  const usersData = [
    {
      username: "mona",
      fullName: "Mona Savio Pereira",
      email: "mona@company.com",
      role: "ADMIN",
      team: "HR",
      desg: "DGM HR and Finance"
    },
    {
      username: "niladri",
      fullName: "Niladri Bose",
      email: "niladri@company.com",
      role: "MANAGER",
      team: "AI",
      desg: "Assistant Vice President"
    },
    {
      username: "nischal",
      fullName: "Nischal Ahuja",
      email: "nischal@company.com",
      role: "EMPLOYEE",
      team: "Finance",
      desg: "Assistant Finance Manager"
    },
    {
      username: "divya",
      fullName: "Divya Verma",
      email: "divya@company.com",
      role: "EMPLOYEE",
      team: "Finance",
      desg: "Employee"
    },
    {
      username: "himanshu",
      fullName: "Himanshu Sharma",
      email: "himanshu@company.com",
      role: "EMPLOYEE",
      team: "Design",
      desg: "Assistant Design Engineer"
    },
    {
      username: "diksha",
      fullName: "Diksha Jaggi",
      email: "diksha@company.com",
      role: "EMPLOYEE",
      team: "AI",
      desg: "Software Developer"
    },
    {
      username: "uttam",
      fullName: "Uttam Rana",
      email: "uttam@company.com",
      role: "EMPLOYEE",
      team: "AI",
      desg: "Software Developer"
    },
    {
      username: "shubham1",
      fullName: "Shubham Sharma",
      email: "shubham.sharma@company.com",
      role: "EMPLOYEE",
      team: "AI",
      desg: "Data Pipeline Engineer"
    },
    {
      username: "shubham2",
      fullName: "Shubham Singh",
      email: "shubham.singh@company.com",
      role: "EMPLOYEE",
      team: "AI",
      desg: "Backend Engineer"
    },
    {
      username: "shridev",
      fullName: "Shridev Cherukat",
      email: "shridev@company.com",
      role: "EMPLOYEE",
      team: "AI",
      desg: "Software Developer"
    },
    {
      username: "steve",
      fullName: "Steve Jacob Thomas",
      email: "steve@company.com",
      role: "EMPLOYEE",
      team: "AI",
      desg: "AI/ML Engineer"
    },
    {
      username: "pranay",
      fullName: "Pranay Rohilla",
      email: "pranay@company.com",
      role: "EMPLOYEE",
      team: "AI",
      desg: "UI/UX Designer"
    }
  ];

  const createdUsers = [];

  for (const u of usersData) {

    const user = await prisma.user.create({
      data: {
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        passwordHash: "demo-password",
        status: "ACTIVE",
        isActive: true
      }
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: getRole(u.role)
      }
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        teamId: getTeam(u.team),
        designationId: getDesg(u.desg)
      }
    });

    await prisma.leaveBalance.create({
      data: {
        employeeId: employee.id,
        year: 2026
      }
    });

    createdUsers.push({ user, employee, role: u.role });
  }

  console.log("✅ Seed completed successfully");
}

function randomAttendance() {
  const statuses =  ["PRESENT","SICK_FULL", "LEAVE_FULL"]

  return statuses[Math.floor(Math.random() * statuses.length)];
}

main()
  .catch(e => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

  // ==============================
// GENERATE FEBRUARY ATTENDANCE
// ==============================

console.log("Generating February attendance...");

const employees = await prisma.employee.findMany();

const holidays = await prisma.holiday.findMany();
const holidayDates = holidays.map(h =>
  new Date(h.date).toISOString().split("T")[0]
);

const start = new Date("2026-02-01");
const end = new Date("2026-02-28");

const attendanceData = [];

for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {

  const date = new Date(d);
  const isoDate = date.toISOString().split("T")[0];
  const day = date.getDay(); // 0 = Sunday

  const weekNumber = Math.ceil(date.getDate() / 7);

  for (const emp of employees) {

    let status;

    // Holiday
    if (holidayDates.includes(isoDate)) {
      status = "HOLIDAY";
    }

    // Sunday
    else if (day === 0) {
      status = "WEEKLY_OFF";
    }

    // 2nd & 4th Saturday
    else if (day === 6 && (weekNumber === 2 || weekNumber === 4)) {
      status = "WEEKLY_OFF";
    }

    // Random working status
    else {
      status = randomAttendance();
    }

    attendanceData.push({
      employeeId: emp.id,
      date: new Date(date),
      status,
      markedById: 1 // HR user
    });

  }
}

await prisma.attendance.createMany({
  data: attendanceData,
  skipDuplicates: true
});

console.log("✅ February attendance generated");