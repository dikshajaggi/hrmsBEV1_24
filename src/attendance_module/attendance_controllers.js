import * as AttendanceService from "./attendance_services.js";
import { can } from "../rbac_module/rbac_can.js";
import { Action } from "../rbac_module/rbac_actions.js";
import { Scope } from "../rbac_module/rbac_scopes.js";

export async function getSheet(req, res) {
  if (!can(req.user.roles, Action.VIEW_ATTENDANCE, Scope.ORG)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const { month } = req.query;

  const sheet = await AttendanceService.getAttendanceSheet(month);

  res.json(sheet);
}

export async function markAttendance(req, res) {
  if (!can(req.user.roles, Action.MARK_ATTENDANCE, Scope.ORG)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  const result = await AttendanceService.markAttendance(
    req.body,
    req.user.id
  );

  res.json(result);
}

export async function removeAttendance(req, res) {
  if (!can(req.user.roles, Action.MARK_ATTENDANCE, Scope.ORG)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  await AttendanceService.removeAttendance(req.body, req.user.id);

  res.json({ message: "Attendance removed" });
}
