import { UserStatus } from "@prisma/client";
import prisma from "../../db/db.config.js"
import { createFirstLoginToken } from "../auth_module/auth_utils.js";
import { accountApprovedTemplate } from "../auth_module/accountApprovedTemplate.js";
import { sendEmail } from "../auth_module/email_services.js";

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
  console.log(data, "user check")
  const user = await prisma.$transaction(async tx => {

    const user = await tx.user.findUnique({
      where: { id: data.userId }
    });

    if (!user) throw new Error("User not found");

    if (user.status !== UserStatus.PENDING_APPROVAL) {
      throw new Error("User already processed");
    }

    const updatedUser = await tx.user.update({
      where: { id: data.userId },
      data: {
        status: UserStatus.ACTIVE,
        isActive: true
      }
    });

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

    await tx.auditLog.create({
      data: {
        entity: "USER",
        entityId: data.userId,
        action: "USER_APPROVED",
        performedById: hrUserId
      }
    });

    return updatedUser;
  });

  /* ---------- SEND EMAIL AFTER TRANSACTION ---------- */

  const token = createFirstLoginToken(user.id);

  const link = `${process.env.FRONTEND_URL}/set-password?token=${token}`;

  const html = accountApprovedTemplate(user.fullName, link);

  await sendEmail({
    to: user.email,
    subject: "Your HRMS Account Has Been Approved",
    html
  });

  return user;
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