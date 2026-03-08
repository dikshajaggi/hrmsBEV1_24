import prisma from "../db/db.config.js"

export async function getAuditLogs(filters) {
  const where = {};

  if (filters.entity) {
    where.entity = filters.entity;
  }

  if (filters.entityId) {
    where.entityId = Number(filters.entityId);
  }

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      performedBy: {
        select: {
          id: true,
          fullName: true,
          email: true
        }
      }
    }
  });
}

