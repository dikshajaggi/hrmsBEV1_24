import { RBAC_POLICY } from "./rbac_policy.js";

export function can(
  userRoles,
  action,
  scope
) {
  // ADMIN shortcut
  if (userRoles.includes("ADMIN")) return true;

  return userRoles.some(role => {
    const rules = RBAC_POLICY[role];
    if (!rules) return false;

    return rules.some(rule => {
      const actionAllowed = rule.action === action || rule.action === "*";

      const scopeAllowed = rule.scope === scope;

      return actionAllowed && scopeAllowed;
    });
  });
}


// IMPORTANT: can() DOES NOT DO EVERYTHING
// can() only checks:
// role
// scope

// It does NOT check:
// ownership (who owns the record)
// state (PENDING / APPROVED)

// Those belong to business logic.
// This separation is VERY important.
