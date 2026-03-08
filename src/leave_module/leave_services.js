import prisma from "../../db/db.config.js";
import { LeaveStatus, LeaveDuration } from "@prisma/client";
import dayjs from "../utils/date.js";
import { can } from "../rbac_module/rbac_can.js";
import { Action } from "../rbac_module/rbac_actions.js";
import { Scope } from "../rbac_module/rbac_scopes.js";

function calculateLeaveDays(leave) {
  if (
    leave.duration === "FIRST_HALF" ||
    leave.duration === "SECOND_HALF"
  ) {
    return 0.5;
  }

  const start = dayjs(leave.fromDate);
  const end = dayjs(leave.toDate);

  return end.diff(start, "day") + 1;
}


export async function updateLeaveBalance(tx, leave) {
  const year = dayjs(leave.fromDate).utc().year();
  const days = calculateLeaveDays(leave);

  // Get existing balance
  let balance = await tx.leaveBalance.findUnique({
    where: {
      employeeId_year: {
        employeeId: leave.employeeId,
        year,
      },
    },
  });

  // Auto-create balance if not exists
  if (!balance) {
    balance = await tx.leaveBalance.create({
      data: {
        employeeId: leave.employeeId,
        year,
        casualTotal: 12,
        sickTotal: 12,
      },
    });
  }

  const isCasual = leave.leaveType.code === "CL";
  const isSick = leave.leaveType.code === "SL";

  if (!isCasual && !isSick) {
    return; // skip if other leave types like LOP
  }

  const available = isCasual
    ? balance.casualTotal - balance.casualUsed
    : balance.sickTotal - balance.sickUsed;

  if (available < days) {
    throw new Error("Insufficient leave balance");
  }

  await tx.leaveBalance.update({
    where: { id: balance.id },
    data: isCasual
      ? { casualUsed: { increment: days } }
      : { sickUsed: { increment: days } },
  });
}


export async function restoreLeaveBalance(tx, leave) {
  const year = dayjs(leave.fromDate).utc().year();
  const days = calculateLeaveDays(leave);

  const balance = await tx.leaveBalance.findUnique({
    where: {
      employeeId_year: {
        employeeId: leave.employeeId,
        year,
      },
    },
  });

  if (!balance) return;

  const isCasual = leave.leaveType.code === "CL";
  const isSick = leave.leaveType.code === "SL";

  if (!isCasual && !isSick) return;

  await tx.leaveBalance.update({
    where: { id: balance.id },
    data: isCasual
      ? { casualUsed: { decrement: days } }
      : { sickUsed: { decrement: days } },
  });
}


// 
// ================= GET LEAVES =================

export async function getLeaves(employeeId, scope) {
  const baseInclude = {
    leaveType: true,
    employee: {
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
    },
  };

  // ORG → All leaves
  if (scope === "ORG") {
    return prisma.leaveRequest.findMany({
      include: baseInclude,
      orderBy: { appliedAt: "desc" },
    });
  }

  // TEAM → Leaves of reportees
  if (scope === "TEAM") {
    return prisma.leaveRequest.findMany({
      where: {
        employee: {
          managerId: employeeId,
        },
      },
      include: baseInclude,
      orderBy: { appliedAt: "desc" },
    });
  }

  // SELF → Own leaves
  return prisma.leaveRequest.findMany({
    where: { employeeId },
    include: baseInclude,
    orderBy: { appliedAt: "desc" },
  });
}

// ===============================
// APPLY LEAVE
// ===============================

export async function applyLeave(user, data) {
  const { leaveTypeId, fromDate, toDate, duration } = data;

  if (!leaveTypeId || !fromDate || !toDate || !duration) {
    throw new Error("Missing required fields");
  }

  if (!Object.values(LeaveDuration).includes(duration)) {
    throw new Error("Invalid leave duration");
  }

  const start = dayjs(fromDate).utc().startOf("day");
  const end = dayjs(toDate).utc().startOf("day");

  if (start.isAfter(end)) {
    throw new Error("Invalid date range");
  }

  if (start.isBefore(dayjs().utc(), "day")) {
    throw new Error("Cannot apply leave for past dates");
  }

  // Half-day must be single day
  if (
    (duration === "FIRST_HALF" || duration === "SECOND_HALF") &&
    !start.isSame(end, "day")
  ) {
    throw new Error("Half-day leave must be for single day");
  }

  // Prevent overlap
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      employeeId: user.id,
      status: { notIn: ["REJECTED", "CANCELLED"] },
      fromDate: { lte: end.toDate() },
      toDate: { gte: start.toDate() },
    },
  });

  if (overlap) {
    throw new Error("Overlapping leave exists");
  }

  // 🔥 Detect if HR/Admin (ORG override permission)
  const isAdmin = can(
    user.roles,
    Action.OVERRIDE_LEAVE,
    Scope.ORG
  );

  return prisma.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.create({
      data: {
        employeeId: user.id,
        leaveTypeId,
        fromDate: start.toDate(),
        toDate: end.toDate(),
        duration,
        status: isAdmin
          ? LeaveStatus.HR_APPROVED
          : LeaveStatus.PENDING,
        approvedByHrId: isAdmin ? user.id : null,
        approvedAtHr: isAdmin ? new Date() : null,
      },
      include: { leaveType: true },
    });

    // 🔥 If auto-approved, deduct balance immediately
    if (isAdmin) {
      await updateLeaveBalance(tx, leave);
    }

    await tx.auditLog.create({
      data: {
        entity: "LEAVE",
        entityId: leave.id,
        action: isAdmin
          ? "AUTO_APPROVED_BY_ADMIN"
          : "APPLIED",
        performedById: user.id,
      },
    });

    return leave;
  });
}

export async function hrAction(user, leaveId, action) {
  return prisma.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.findUnique({
      where: { id: Number(leaveId) },
      include: { leaveType: true },
    });

    if (!leave) throw new Error("Leave not found");

    const oldStatus = leave.status;
    let newStatus;

    if (action === "APPROVE") {
      if (oldStatus !== "MANAGER_APPROVED") {
        throw new Error("Leave must be manager approved first");
      }

      // BALANCE VALIDATION
      const year = dayjs(leave.fromDate).year();
      const days = calculateLeaveDays(leave);

      let balance = await tx.leaveBalance.findUnique({
        where: {
          employeeId_year: {
            employeeId: leave.employeeId,
            year,
          },
        },
      });

      if (!balance) {
        balance = await tx.leaveBalance.create({
          data: {
            employeeId: leave.employeeId,
            year,
          },
        });
      }

      const available =
        leave.leaveType.code === "CL"
          ? balance.casualTotal - balance.casualUsed
          : balance.sickTotal - balance.sickUsed;

      if (available < days) {
        throw new Error("Insufficient leave balance");
      }

      newStatus = "HR_APPROVED";
    } else if (action === "REJECT") {
      newStatus = "REJECTED";
    } else if (action === "CANCEL") {
      newStatus = "CANCELLED";
    } else {
      throw new Error("Invalid action");
    }

    const updatedLeave = await tx.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: newStatus,
        approvedByHrId: user.id,
        approvedAtHr: new Date(),
      },
    });

    if (oldStatus !== "HR_APPROVED" && newStatus === "HR_APPROVED") {
      await updateLeaveBalance(tx, leave);
    }

    if (oldStatus === "HR_APPROVED" && newStatus !== "HR_APPROVED") {
      await restoreLeaveBalance(tx, leave);
    }

    await tx.auditLog.create({
      data: {
        entity: "LEAVE",
        entityId: leave.id,
        action: newStatus,
        performedById: user.id,
      },
    });

    return updatedLeave;
  });
}


// ================= MANAGER ACTION =================

export async function managerAction(user, leaveId, action) {
  if (!["APPROVE", "REJECT"].includes(action)) {
    throw new Error("Invalid action");
  }

  return prisma.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.findUnique({
      where: { id: Number(leaveId) },
      include: { employee: true },
    });

    if (!leave) throw new Error("Leave not found");

    if (leave.status !== "PENDING") {
      throw new Error("Leave already processed");
    }

    if (leave.employee.managerId !== user.employeeId) {
      throw new Error("Not your team member");
    }

    const newStatus =
      action === "APPROVE"
        ? "MANAGER_APPROVED"
        : "REJECTED";

    const updatedLeave = await tx.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: newStatus,
        approvedByManagerId: user.employeeId,
        approvedAtManager: new Date(),
      },
    });

    await tx.auditLog.create({
      data: {
        entity: "LEAVE",
        entityId: leave.id,
        action: newStatus,
        performedById: user.id,
      },
    });

    return updatedLeave;
  });
}

export async function cancelLeave(user, leaveId) {
  return prisma.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.findUnique({
      where: { id: Number(leaveId) },
      include: { leaveType: true },
    });

    if (!leave) {
      throw new Error("Leave not found");
    }

    // 🔒 User can only cancel their own leave
    if (leave.employeeId !== user.id) {
      throw new Error("Not allowed to cancel this leave");
    }

    // ❌ Already closed
    if (
      leave.status === "REJECTED" ||
      leave.status === "CANCELLED"
    ) {
      throw new Error("Leave already closed");
    }

    // ❌ Cannot cancel past leave
    if (dayjs(leave.fromDate).utc().isBefore(dayjs().utc(), "day")) {
      throw new Error("Cannot cancel past leave");
    }

    const oldStatus = leave.status;

    const updatedLeave = await tx.leaveRequest.update({
      where: { id: leave.id },
      data: {
        status: "CANCELLED",
      },
    });

    // 🔥 Restore balance if already approved
    if (oldStatus === "HR_APPROVED") {
      await restoreLeaveBalance(tx, leave);
    }

    await tx.auditLog.create({
      data: {
        entity: "LEAVE",
        entityId: leave.id,
        action: "CANCELLED_BY_EMPLOYEE",
        performedById: user.id,
      },
    });

    return updatedLeave;
  });
}

export async function updateLeave(user, leaveId, data) {
  const { leaveTypeId, fromDate, toDate, duration } = data;

  if (!leaveTypeId || !fromDate || !toDate || !duration) {
    throw new Error("Missing required fields");
  }

  const start = dayjs(fromDate).utc().startOf("day");
  const end = dayjs(toDate).utc().startOf("day");

  if (start.isAfter(end)) {
    throw new Error("Invalid date range");
  }

  if (
    (duration === "FIRST_HALF" || duration === "SECOND_HALF") &&
    !start.isSame(end, "day")
  ) {
    throw new Error("Half-day leave must be single day");
  }

  return prisma.$transaction(async (tx) => {
    const leave = await tx.leaveRequest.findUnique({
      where: { id: Number(leaveId) },
    });

    if (!leave) {
      throw new Error("Leave not found");
    }

    // 🔒 Only owner can update
    if (leave.employeeId !== user.id) {
      throw new Error("Not allowed");
    }

    // 🔒 Only pending leaves can be updated
    if (leave.status !== "PENDING") {
      throw new Error("Only pending leave can be updated");
    }

    // 🔍 Check overlap (excluding current leave)
    const overlap = await tx.leaveRequest.findFirst({
      where: {
        employeeId: user.id,
        id: { not: leave.id },
        status: { notIn: ["REJECTED", "CANCELLED"] },
        fromDate: { lte: end.toDate() },
        toDate: { gte: start.toDate() },
      },
    });

    if (overlap) {
      throw new Error("Overlapping leave exists");
    }

    const updatedLeave = await tx.leaveRequest.update({
      where: { id: leave.id },
      data: {
        leaveTypeId,
        fromDate: start.toDate(),
        toDate: end.toDate(),
        duration,
      },
    });

    await tx.auditLog.create({
      data: {
        entity: "LEAVE",
        entityId: leave.id,
        action: "UPDATED_BY_EMPLOYEE",
        performedById: user.id,
      },
    });

    return updatedLeave;
  });
}