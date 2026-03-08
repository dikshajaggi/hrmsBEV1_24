import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

//npx prisma db seed


async function main() {
  console.log(" Seeding master data...");

  // Roles
  const roles = ["EMPLOYEE", "MANAGER", "ADMIN"];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role },
      update: {},
      create: {
        code: role,
        name: role,
      },
    });
  }

  // Default Team
  await prisma.team.upsert({
    where: { name: "Delhi - Dwarka" },
    update: {},
    create: { name: "Delhi - Dwarka" },
  });

  // Default Designation
  await prisma.designation.upsert({
    where: { name: "Software Engineer" },
    update: {},
    create: { name: "Software Engineer" },
  });

// Leave Types
const leaveTypes = [
  { code: "CL", name: "Casual Leave" },
  { code: "SL", name: "Sick Leave" },
  { code: "PL", name: "Paid Leave" },
];

for (const leave of leaveTypes) {
  await prisma.leaveType.upsert({
    where: { code: leave.code },
    update: {},
    create: leave,
  });
}
  // Weekly Off - all Sundays

  await prisma.weeklyOffRule.upsert({
  where: { dayOfWeek: 0 },
  update: {},
  create: {
    dayOfWeek: 0,
    weekNumbers: [1,2,3,4,5]
  }
});
  // Weekly Off - 2nd & 4th Saturday

await prisma.weeklyOffRule.upsert({
  where: { dayOfWeek: 6 },
  update: {},
  create: {
    dayOfWeek: 6,
    weekNumbers: [2, 4],
  },
});

  console.log("Seeding complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
