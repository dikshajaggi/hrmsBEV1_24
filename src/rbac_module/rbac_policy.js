import { Action } from "./rbac_actions.js";
import { Scope } from "./rbac_scopes.js";

export const RBAC_POLICY = {
  EMPLOYEE: [
    { action: Action.APPLY_LEAVE, scope: Scope.SELF },
    { action: Action.VIEW_LEAVE, scope: Scope.SELF },
    // { action: Action.MARK_ATTENDANCE, scope: Scope.SELF },
    { action: Action.VIEW_ATTENDANCE, scope: Scope.SELF }
  ],

  MANAGER: [
    { action: Action.APPROVE_LEAVE, scope: Scope.TEAM },
    { action: Action.VIEW_LEAVE, scope: Scope.TEAM },
    { action: Action.VIEW_ATTENDANCE, scope: Scope.TEAM }
  ],

  ADMIN: [
    { action: "*", scope: Scope.ORG }
  ]
};
