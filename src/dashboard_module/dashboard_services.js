import prisma from "../../db/db.config.js";
import dayjs from "../utils/date.js";
import { AttendanceStatus, LeaveStatus } from "@prisma/client";
import { can } from "../rbac_module/rbac_can.js";
import { Action } from "../rbac_module/rbac_actions.js";
import { Scope } from "../rbac_module/rbac_scopes.js";

export async function getDashboardData(user) {
  const isAdmin = can(user.roles, Action.VIEW_ATTENDANCE, Scope.ORG);
  const isManager = can(user.roles, Action.VIEW_ATTENDANCE, Scope.TEAM);

  if (isAdmin) {
    return getAdminDashboard(user);
  }

  if (isManager) {
    return getManagerDashboard(user);
  }

  return getEmployeeDashboard(user);
}


async function getEmployeeDashboard(user) {
  const employeeId = user.employeeId;
  const today = dayjs().utc();
  const startOfMonth = today.startOf("month");
  const endOfMonth = today.endOf("month");

  const [
    balance,
    attendanceCount,
    pendingLeaves,
    recentLeaves,
    upcomingHolidays
  ] = await Promise.all([

    prisma.leaveBalance.findUnique({
      where: {
        employeeId_year: {
          employeeId,
          year: today.year()
        }
      }
    }),

    prisma.attendance.count({
      where: {
        employeeId,
        date: { gte: startOfMonth.toDate(), lte: endOfMonth.toDate() }
      }
    }),

    prisma.leaveRequest.count({
      where: {
        employeeId,
        status: LeaveStatus.PENDING
      }
    }),

    prisma.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { appliedAt: "desc" },
      take: 5
    }),

    prisma.holiday.findMany({
      where: {
        date: { gte: today.toDate(), lte: today.add(30, "day").toDate() },
        isActive: true
      },
      orderBy: { date: "asc" }
    })
  ]);
  

  return {
    role: "EMPLOYEE",
    leaveSummary: {
      totalCL: balance?.casualTotal || 0,
      usedCL: balance?.casualUsed || 0,
      remainingCL: (balance?.casualTotal || 0) - (balance?.casualUsed || 0),
      totalSL: balance?.sickTotal || 0,
      usedSL: balance?.sickUsed || 0,
      remainingSL: (balance?.sickTotal || 0) - (balance?.sickUsed || 0),
    },
    attendanceSummary: {
      totalMarkedDays: attendanceCount
    },
    leaveStatus: {
      pending: pendingLeaves,
      recent: recentLeaves
    },
    upcomingHolidays
  };
}


async function getManagerDashboard(user) {
  const employeeId = user.employeeId;

  const teamMembers = await prisma.employee.findMany({
    where: { managerId: employeeId },
    select: { id: true }
  });

  const teamIds = teamMembers.map(e => e.id);

  const [
    pendingApprovals,
    todayPresent,
    todayAbsent
  ] = await Promise.all([

    prisma.leaveRequest.count({
      where: {
        employee: { managerId: employeeId },
        status: LeaveStatus.PENDING
      }
    }),

    prisma.attendance.count({
      where: {
        employeeId: { in: teamIds },
        date: dayjs().utc().startOf("day").toDate(),
        status: "PRESENT"
      }
    }),

    prisma.attendance.count({
      where: {
        employeeId: { in: teamIds },
        date: dayjs().utc().startOf("day").toDate(),
        status: "LEAVE_FULL"
      }
    })
  ]);

  const employeeData = await getEmployeeDashboard(user);

  return {
    role: "MANAGER",
    ...employeeData,
    teamSummary: {
      pendingApprovals,
      todayPresent,
      todayAbsent
    }
  };
}


async function getAdminDashboard(user) {
  const today = dayjs().utc().startOf("day");
  const endOfToday = today.endOf("day");
  const startOfMonth = today.startOf("month");
  const endOfMonth = today.endOf("month");
  const year = today.year();

  const [
    totalEmployees,
    todayAttendance,
    totalMale,
    totalFemale,
    totalOther,
    teamStats,
    teams,
    monthlyAttendance,
    leaveBalances
  ] = await Promise.all([

    // Total active employees
    prisma.employee.count({
      where: { status: "ACTIVE" }
    }),

    // Today's attendance grouped by status
    prisma.attendance.groupBy({
      by: ["status"],
      where: {
        date: {
          gte: today.toDate(),
          lte: endOfToday.toDate()
        }
      },
      _count: { status: true }
    }),

    // Gender distribution
    prisma.employee.count({
      where: { status: "ACTIVE", gender: "MALE" }
    }),

    prisma.employee.count({
      where: { status: "ACTIVE", gender: "FEMALE" }
    }),

    prisma.employee.count({
      where: { status: "ACTIVE", gender: "OTHER" }
    }),

    // Team grouping
    prisma.employee.groupBy({
      by: ["teamId"],
      where: { status: "ACTIVE" },
      _count: true
    }),

    prisma.team.findMany(),

    // Monthly attendance grouped by date
    prisma.attendance.groupBy({
      by: ["date"],
      where: {
        date: {
          gte: startOfMonth.toDate(),
          lte: endOfMonth.toDate()
        }
      },
      _count: { status: true }
    }),

    // Leave balances with employee info
    prisma.leaveBalance.findMany({
      where: { year },
      include: {
        employee: {
          include: {
            user: true,
            team: true
          }
        }
      }
    })
  ]);

  // =========================
  // Process Today's Attendance
  // =========================

  const attendanceMap = {};
  todayAttendance.forEach(item => {
    attendanceMap[item.status] = item._count.status;
  });

  const present = attendanceMap[AttendanceStatus.PRESENT] || 0;
  const wfh = attendanceMap[AttendanceStatus.WFH] || 0;
  const leaveFull = attendanceMap[AttendanceStatus.LEAVE_FULL] || 0;
  const sickFull = attendanceMap[AttendanceStatus.SICK_FULL] || 0;
  const firstHalf = attendanceMap[AttendanceStatus.LEAVE_FIRST_HALF] || 0;
  const secondHalf = attendanceMap[AttendanceStatus.LEAVE_SECOND_HALF] || 0;
  const compOff = attendanceMap[AttendanceStatus.COMP_OFF] || 0;

  const accounted =
    present + wfh + leaveFull + sickFull + firstHalf + secondHalf + compOff;

  const absent = Math.max(totalEmployees - accounted, 0);

  // =========================
  // Team Summary
  // =========================

  const teamSummary = teams.map(team => ({
    team: team.name,
    totalEmployees:
      teamStats.find(t => t.teamId === team.id)?._count || 0
  }));

  // =========================
  // Monthly Graph Data
  // =========================

  const monthlyGraph = monthlyAttendance.map(item => ({
    date: dayjs(item.date).format("YYYY-MM-DD"),
    totalMarked: item._count.status
  }));

  // =========================
  // Leave Balance Alerts
  // =========================

  const lowCasualLeave = [];
  const lowSickLeave = [];

  leaveBalances.forEach(balance => {
    if (!balance.employee || balance.employee.status !== "ACTIVE") return;

    const remainingCL = balance.casualTotal - balance.casualUsed;
    const remainingSL = balance.sickTotal - balance.sickUsed;

    if (remainingCL <= 3) {
      lowCasualLeave.push({
        employeeId: balance.employee.id,
        name: balance.employee.user.fullName,
        team: balance.employee.team.name,
        remainingCL,
        severity: remainingCL === 0 ? "CRITICAL" : "WARNING"
      });
    }

    if (remainingSL <= 3) {
      lowSickLeave.push({
        employeeId: balance.employee.id,
        name: balance.employee.user.fullName,
        team: balance.employee.team.name,
        remainingSL,
        severity: remainingSL === 0 ? "CRITICAL" : "WARNING"
      });
    }
  });

  // =========================
  // Final Response
  // =========================

  return {
    role: "ADMIN",

    workforceToday: {
      totalEmployees,
      present,
      wfh,
      leaveFull,
      sickFull,
      firstHalf,
      secondHalf,
      compOff,
      absent
    },

    employeeDistribution: {
      totalEmployees,
      totalMale,
      totalFemale,
      totalOther
    },

    leaveBalanceAlerts: {
      lowCasualLeave,
      lowSickLeave
    },

    teamSummary,

    monthlyGraph
  };
}

// async function getAdminDashboard(user) {
//   const [
//     totalEmployees,
//     pendingRegistrations,
//     totalPendingLeaves
//   ] = await Promise.all([

//     prisma.employee.count({
//       where: { status: "ACTIVE" }
//     }),

//     prisma.user.count({
//       where: { status: "PENDING_APPROVAL" }
//     }),

//     prisma.leaveRequest.count({
//       where: { status: LeaveStatus.PENDING }
//     })
//   ]);

//   return {
//     role: "ADMIN",
//     totalEmployees,
//     pendingRegistrations,
//     totalPendingLeaves
//   };
// }