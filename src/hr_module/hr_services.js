import { UserStatus } from "@prisma/client";
import prisma from "../../db/db.config.js"

export async function fetchPendingUsers() {
  return prisma.user.findMany({
    where: {
      status: UserStatus.PENDING_APPROVAL
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      createdAt: true
    }
  });
}



export async function approveUser(data, hrUserId) {
  return prisma.$transaction(async tx => {
    const user = await tx.user.findUnique({
      where: { id: data.userId }
    });

    if (!user) throw new Error("User not found");

    if (user.status !== UserStatus.PENDING_APPROVAL) {
      throw new Error("User already processed");
    }

    // 1️⃣ Activate user
    await tx.user.update({
      where: { id: data.userId },
      data: {
        status: UserStatus.ACTIVE,
        isActive: true
      }
    });

    // 2️⃣ Assign roles
    const roles = await tx.role.findMany({
      where: { code: { in: data.roles } }
    });

    for (const role of roles) {
      await tx.userRole.create({
        data: {
          userId: data.userId,
          roleId: role.id
        }
      });
    }

    // 3️⃣ Create Employee record (if EMPLOYEE or MANAGER)
    if (data.roles.includes("EMPLOYEE") || data.roles.includes("MANAGER")) {
      if (!data.teamId || !data.designationId) {
        throw new Error("Employee details missing");
      }

      await tx.employee.create({
        data: {
          userId: data.userId,
          teamId: data.teamId,
          designationId: data.designationId,
          managerId: data.managerId
        }
      });
    }
    // AUDIT LOG
    await tx.auditLog.create({
      data: {
        entity: "USER",
        entityId: data.userId,
        action: "USER_APPROVED",
        performedById: hrUserId // req.user.id
      }
    });
  });
}


export async function rejectUser(data, hrUserId) {
  console.log(data, hrUserId, "hrUserId")
  await prisma.$transaction(async (tx) => {
  await tx.user.update({
    where: { id: data.userId },
    data: {
      status: "REJECTED",
      isActive: false
    }
  });

  await tx.auditLog.create({
    data: {
      entity: "USER",
      entityId: data.userId,
      action: "USER_REJECTED",
      performedById: hrUserId
    }
  });
});
}