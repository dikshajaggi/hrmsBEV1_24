import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js"

import * as WeeklyOffController from "./weeklyoff_controllers.js";
import { Scope } from "../rbac_module/rbac_scopes.js";
import { Action } from "../rbac_module/rbac_actions.js";
import { can } from "../rbac_module/rbac_can.js";

const router = Router();

// Middleware to allow only ADMIN
function requireAdmin(req, res, next) {
  if (!can(req.user.roles, Action.APPROVE_USER, Scope.ORG)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

router.post(
  "/",
  authenticate,
  requireAdmin,
  WeeklyOffController.createWeeklyOffRule
);

router.get(
  "/",
  authenticate,
  requireAdmin,
  WeeklyOffController.getWeeklyOffRules
);

router.put(
  "/:id",
  authenticate,
  requireAdmin,
  WeeklyOffController.updateWeeklyOffRule
);

router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  WeeklyOffController.deleteWeeklyOffRule
);

export default router;
