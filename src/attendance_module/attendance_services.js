import prisma from "../../db/db.config.js";
import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import dayjs from "../utils/date.js";

export async function getAttendanceSheet(month, page = 1, limit = 50) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Month must be in YYYY-MM format");
  }

  const startDate = dayjs.utc(`${month}-01`, "YYYY-MM-DD");
  const endDate = startDate.endOf("month");

  if (!startDate.isValid()) {
    throw new Error("Invalid month format");
  }

  const skip = (page - 1) * limit;

  // 1️⃣ Fetch paginated employees first
  const employees = await prisma.employee.findMany({
    where: { status: "ACTIVE" },
    include: { user: true, team: true },
    skip,
    take: limit,
  });

  const employeeIds = employees.map(e => e.id);

  console.log(await prisma.weeklyOffRule.findMany(), "prisma.weeklyOffRule.findMany()")

  // 2️⃣ Fetch dependent data in parallel
  const [
    holidays,
    weeklyOffRules,
    attendanceRecords,
    approvedLeaves,
    totalEmployees
  ] = await Promise.all([

    prisma.holiday.findMany({
      where: {
        date: { gte: startDate.toDate(), lte: endDate.toDate() },
        isActive: true
      }
    }),

    prisma.weeklyOffRule.findMany({
      where: { isActive: true }
    }),

    prisma.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startDate.toDate(), lte: endDate.toDate() }
      }
    }),

    prisma.leaveRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: LeaveStatus.HR_APPROVED,
        fromDate: { lte: endDate.toDate() },
        toDate: { gte: startDate.toDate() }
      }
    }),

    prisma.employee.count({
      where: { status: "ACTIVE" }
    })
  ]);

  // =========================
  // PREPARE FAST LOOKUPS
  // =========================

  const holidaySet = new Set(
    holidays.map(h => dayjs(h.date).utc().format("YYYY-MM-DD"))
  );

  const attendanceMap = new Map();
  attendanceRecords.forEach(record => {
    const key = `${record.employeeId}_${dayjs(record.date).utc().format("YYYY-MM-DD")}`;
    attendanceMap.set(key, record.status);
  });

  const leaveMap = new Map();
  approvedLeaves.forEach(leave => {
    if (!leaveMap.has(leave.employeeId)) {
      leaveMap.set(leave.employeeId, []);
    }

    leaveMap.get(leave.employeeId).push({
      from: dayjs(leave.fromDate).utc(),
      to: dayjs(leave.toDate).utc(),
      duration: leave.duration
    });
  });

  // 🔥 Build weekly map ONCE (major optimization)
  const weeklyMap = new Map();
  weeklyOffRules.forEach(rule => {
    if (!weeklyMap.has(rule.dayOfWeek)) {
      weeklyMap.set(rule.dayOfWeek, []);
    }
    weeklyMap.get(rule.dayOfWeek).push(rule.weekNumbers);
  });

  // =========================
  // BUILD SHEET
  // =========================

  const sheet = [];

  for (const emp of employees) {
    const row = {
      employeeId: emp.id,
      name: emp.user.fullName,
      team: emp.team.name,
      attendance: {},
      summary: {
        totalLeaveDays: 0,
        totalSickDays: 0,
        totalCompOff: 0,
        totalWFH: 0,
        totalAbsence: 0,
        totalPresentDays: 0,
        totalWorkingDays: 0
      }
    };

    const empLeaves = leaveMap.get(emp.id) || [];
    let current = startDate.clone();

    while (current.isSameOrBefore(endDate, "day")) {
      const dateStr = current.format("YYYY-MM-DD");
      const key = `${emp.id}_${dateStr}`;
      let status = null;

      const isHoliday = holidaySet.has(dateStr);

      // Holiday
      if (isHoliday) {
        status = AttendanceStatus.HOLIDAY;
      }

      // Weekly Off
      if (!status) {
        const rules = weeklyMap.get(current.day());
        if (rules) {
          const weekNumber = Math.ceil(current.date() / 7);
          const isOff = rules.some(weeks =>
            weeks.includes(weekNumber)
          );
          if (isOff) status = AttendanceStatus.WEEKLY_OFF;
        }
      }

      // Leave
      if (!status && empLeaves.length > 0) {
        for (const leave of empLeaves) {
          if (current.isBetween(leave.from, leave.to, null, "[]")) {
            if (leave.duration === "FULL_DAY") {
              status = AttendanceStatus.LEAVE_FULL;
            } else if (leave.duration === "FIRST_HALF") {
              status = AttendanceStatus.LEAVE_FIRST_HALF;
            } else if (leave.duration === "SECOND_HALF") {
              status = AttendanceStatus.LEAVE_SECOND_HALF;
            }
            break;
          }
        }
      }

      // Manual override (highest priority)
      if (attendanceMap.has(key)) {
        status = attendanceMap.get(key);
      }

      if (!status) {
        status = AttendanceStatus.PRESENT;
      }

      row.attendance[dateStr] = status;

      // ===== Summary Logic =====

      const isWorkingDay =
        status !== AttendanceStatus.HOLIDAY &&
        status !== AttendanceStatus.WEEKLY_OFF;

      if (isWorkingDay) row.summary.totalWorkingDays++;

      if (status === AttendanceStatus.PRESENT) {
        row.summary.totalPresentDays++;
      }

      if (status === AttendanceStatus.LEAVE_FULL) {
        row.summary.totalLeaveDays++;
        row.summary.totalAbsence++;
      }

      if (
        status === AttendanceStatus.LEAVE_FIRST_HALF ||
        status === AttendanceStatus.LEAVE_SECOND_HALF
      ) {
        row.summary.totalLeaveDays += 0.5;
        row.summary.totalAbsence += 0.5;
      }

      if (status === AttendanceStatus.SICK_FULL) {
        row.summary.totalSickDays++;
        row.summary.totalAbsence++;
      }

      if (
        status === AttendanceStatus.SICK_FIRST_HALF ||
        status === AttendanceStatus.SICK_SECOND_HALF
      ) {
        row.summary.totalSickDays += 0.5;
        row.summary.totalAbsence += 0.5;
      }

      if (status === AttendanceStatus.WFH) {
        row.summary.totalWFH++;
      }

      current = current.add(1, "day");
    }

    sheet.push(row);
  }

  return {
    data: sheet,
    pagination: {
      page,
      limit,
      totalEmployees,
      totalPages: Math.ceil(totalEmployees / limit)
    }
  };
}

export async function markAttendance(data, markedById) {
  const { employeeId, date, status } = data;

  if (!employeeId || !date || !status) {
    throw new Error("Missing required fields");
  }

  const targetDate = dayjs.utc(date + "T00:00:00Z");

  if (targetDate.isAfter(dayjs().utc(), "day")) {
    throw new Error("Cannot mark future attendance");
  }

  if (!Object.values(AttendanceStatus).includes(status)) {
    throw new Error("Invalid attendance status");
  }

  return prisma.$transaction(async (tx) => {
    const employee = await tx.employee.findUnique({
      where: { id: employeeId }
    });

    if (!employee || employee.status !== "ACTIVE") {
      throw new Error("Invalid employee");
    }

    const holiday = await tx.holiday.findFirst({
      where: {
        date: targetDate.toDate(),
        isActive: true
      }
    });

    if (holiday) {
      throw new Error("Cannot mark attendance on holiday");
    }

    const attendance = await tx.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: targetDate.toDate()
        }
      },
      update: {
        status,
        markedById
      },
      create: {
        employeeId,
        date: targetDate.toDate(),
        status,
        markedById
      }
    });

    await tx.auditLog.create({
      data: {
        entity: "ATTENDANCE",
        entityId: attendance.id,
        action: "UPSERT",
        performedById: markedById
      }
    });

    return attendance;
  });
}

export async function removeAttendance(data, performedById) {
  const { employeeId, date } = data;

  if (!employeeId || !date) {
    throw new Error("Missing required fields");
  }

  const targetDate = dayjs(date).utc().startOf("day");

  return prisma.$transaction(async (tx) => {
    const existing = await tx.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: targetDate.toDate()
        }
      }
    });

    if (!existing) {
      throw new Error("Attendance not found");
    }

    await tx.attendance.delete({
      where: {
        employeeId_date: {
          employeeId,
          date: targetDate.toDate()
        }
      }
    });

    await tx.auditLog.create({
      data: {
        entity: "ATTENDANCE",
        entityId: existing.id,
        action: "DELETE",
        performedById
      }
    });

    return { message: "Attendance removed" };
  });
}