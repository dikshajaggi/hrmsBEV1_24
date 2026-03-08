import { getAuditLogs } from "./audit.service";

export async function fetchAuditLogs(req, res) {
      // 🔐 RBAC CHECK HAPPENS HERE
  if (!can(req.user.roles, Action.VIEW_AUDIT_LOGS, Scope.ORG)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  
  const logs = await getAuditLogs(req.query);
  res.json(logs);
}

