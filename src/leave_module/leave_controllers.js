import { Action } from "../rbac_module/rbac_actions.js";
import { can } from "../rbac_module/rbac_can.js";
import { Scope } from "../rbac_module/rbac_scopes.js";
import {
  applyLeave,
  cancelLeave,
  getLeaves,
  hrAction,
  managerAction,
  updateLeave,
} from "./leave_services.js";

// ===================== APPLY =====================

export async function applyLeaves(req, res) {
  try {
    if (!can(req.user.roles, Action.APPLY_LEAVE, Scope.SELF)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    console.log(req.user, "user details check")
    await applyLeave(req.user, req.body);

    res.status(201).json({ message: "Leave applied successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// ===================== GET =====================

export async function getAllLeaves(req, res) {
  try {
    const user = req.user;

    let scope;

    if (can(user.roles, Action.VIEW_LEAVE, Scope.ORG)) {
      scope = Scope.ORG;
    } else if (can(user.roles, Action.VIEW_LEAVE, Scope.TEAM)) {
      scope = Scope.TEAM;
    } else if (can(user.roles, Action.VIEW_LEAVE, Scope.SELF)) {
      scope = Scope.SELF;
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }

    const leaves = await getLeaves(user.employeeId, scope);

    res.json(leaves);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// ===================== MANAGER ACTION =====================

export async function actionByManager(req, res) {
  try {
    if (!can(req.user.roles, Action.APPROVE_LEAVE, Scope.TEAM)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { action } = req.body;

    await managerAction(req.user, req.params.id, action);

    res.json({ message: `Leave ${action} by manager` });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

// ===================== HR ACTION =====================

export async function actionByHr(req, res) {
  try {
    if (!can(req.user.roles, Action.OVERRIDE_LEAVE, Scope.ORG)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { action } = req.body;

    await hrAction(req.user, req.params.id, action);

    res.json({ message: `Leave ${action} by HR` });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function cancelLeaveController(req, res) {
  try {
    await cancelLeave(req.user, req.params.id);

    res.json({ message: "Leave cancelled successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function updateLeaveController(req, res) {
  try {
    const updated = await updateLeave(
      req.user,
      req.params.id,
      req.body
    );

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}