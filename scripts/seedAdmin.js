import bcrypt from "bcrypt";
import prisma from "../db/db.config.js";
import { UserStatus } from "@prisma/client";

async function seedAdmin() {
  const existingAdmin = await prisma.user.findFirst({
    where: {
      roles: {
        some: {
          role: { code: "ADMIN" }
        }
      }
    }
  });

  const team = await prisma.team.findFirst();
  const designation = await prisma.designation.findFirst();

  if (!team || !designation) {
    throw new Error("Team or Designation not seeded yet.");
  }

  if (existingAdmin) {
    console.log("Admin already exists");

    const existingEmployee = await prisma.employee.findUnique({
      where: { userId: existingAdmin.id }
    });

    if (!existingEmployee) {
      await prisma.$transaction(async (tx) => {
        const employee = await tx.employee.create({
          data: {
            userId: existingAdmin.id,
            designationId: designation.id,
            teamId: team.id
          }
        });

        await tx.leaveBalance.create({
          data: {
            employeeId: employee.id,
            year: new Date().getFullYear(),
            casualTotal: 12,
            casualUsed: 0,
            sickTotal: 12,
            sickUsed: 0
          }
        });
      });

      console.log("Employee + LeaveBalance created for Admin");
    }

    return;
  }

  // Fresh DB case
  const passwordHash = await bcrypt.hash("Admin@123", 12);

  await prisma.$transaction(async (tx) => {
    const adminUser = await tx.user.create({
      data: {
        username: "admin",
        email: "admin@company.com",
        fullName: "System Admin",
        passwordHash,
        status: UserStatus.ACTIVE,
        isActive: true,
        isFirstLogin: false,
        roles: {
          create: {
            role: {
              connect: { code: "ADMIN" }
            }
          }
        }
      }
    });

    const employee = await tx.employee.create({
      data: {
        userId: adminUser.id,
        designationId: designation.id,
        teamId: team.id
      }
    });

    await tx.leaveBalance.create({
      data: {
        employeeId: employee.id,
        year: new Date().getFullYear(),
        casualTotal: 12,
        casualUsed: 0,
        sickTotal: 12,
        sickUsed: 0
      }
    });

    console.log("Admin created:", adminUser.username);
  });
}

seedAdmin()
  .catch(console.error)
  .finally(() => prisma.$disconnect());