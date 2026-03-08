import * as HolidayService from "./holiday_services.js";
import { can } from "../rbac_module/rbac_can.js";
import { Action } from "../rbac_module/rbac_actions.js";
import { Scope } from "../rbac_module/rbac_scopes.js";

// ================= CREATE =================

export async function createHoliday(req, res) {
  try {
    if (!can(req.user.roles, Action.MANAGE_HOLIDAY, Scope.ORG)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const holiday = await HolidayService.createHoliday(req.body);
    res.status(201).json(holiday);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// ================= GET =================

export async function getHolidays(req, res) {
  try {
    const { year } = req.query;
    const holidays = await HolidayService.getHolidays(year);
    res.json(holidays);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// ================= DELETE =================

export async function deleteHoliday(req, res) {
  try {
    if (!can(req.user.roles, Action.MANAGE_HOLIDAY, Scope.ORG)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await HolidayService.deleteHoliday(req.params.id);
    res.json({ message: "Holiday deactivated successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}