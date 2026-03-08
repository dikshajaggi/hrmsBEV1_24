import prisma from "../../db/db.config.js";

// =======================
// VALIDATION HELPERS
// =======================

function validateDayOfWeek(dayOfWeek) {
  if (dayOfWeek === undefined || dayOfWeek === null) {
    throw new Error("dayOfWeek required");
  }

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new Error("dayOfWeek must be integer between 0 and 6");
  }
}

function validateWeekNumbers(weekNumbers) {
  if (!Array.isArray(weekNumbers) || weekNumbers.length === 0) {
    throw new Error("weekNumbers must be non-empty array");
  }

  const validWeeks = [1, 2, 3, 4, 5];

  const uniqueWeeks = [...new Set(weekNumbers)];

  uniqueWeeks.forEach((week) => {
    if (!validWeeks.includes(week)) {
      throw new Error("Invalid week number. Allowed values: 1-5");
    }
  });

  return uniqueWeeks.sort();
}

// =======================
// CREATE
// =======================

export async function createWeeklyOffRule(data, userId) {
  const { dayOfWeek, weekNumbers } = data;

  validateDayOfWeek(dayOfWeek);
  const validatedWeeks = validateWeekNumbers(weekNumbers);

  return prisma.$transaction(async (tx) => {

    const existing = await tx.weeklyOffRule.findUnique({
      where: { dayOfWeek }
    });

    let rule;

    if (existing) {
      // 🔥 Update existing rule
      rule = await tx.weeklyOffRule.update({
        where: { dayOfWeek },
        data: {
          weekNumbers: validatedWeeks,
          isActive: true
        }
      });
    } else {
      // 🔥 Create new rule
      rule = await tx.weeklyOffRule.create({
        data: {
          dayOfWeek,
          weekNumbers: validatedWeeks,
          isActive: true
        }
      });
    }

    await tx.auditLog.create({
      data: {
        entity: "WEEKLY_OFF",
        entityId: rule.id,
        action: existing ? "UPDATED" : "CREATED",
        performedById: userId,
      },
    });

    return rule;
  });
}
// =======================
// GET
// =======================

export async function getWeeklyOffRules() {
  return prisma.weeklyOffRule.findMany({
    where: { isActive: true },
    orderBy: { dayOfWeek: "asc" },
  });
}

// =======================
// UPDATE
// =======================

export async function updateWeeklyOffRule(id, data, userId) {
  const ruleId = Number(id);

  if (!ruleId) {
    throw new Error("Invalid rule id");
  }

  const existing = await prisma.weeklyOffRule.findUnique({
    where: { id: ruleId },
  });

  if (!existing || !existing.isActive) {
    throw new Error("Rule not found");
  }

  const validatedWeeks = validateWeekNumbers(data.weekNumbers);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.weeklyOffRule.update({
      where: { id: ruleId },
      data: {
        weekNumbers: validatedWeeks,
      },
    });

    await tx.auditLog.create({
      data: {
        entity: "WEEKLY_OFF",
        entityId: updated.id,
        action: "UPDATED",
        performedById: userId,
      },
    });

    return updated;
  });
}

// =======================
// DELETE (SOFT DELETE)
// =======================

export async function deleteWeeklyOffRule(id, userId) {
  const ruleId = Number(id);

  if (!ruleId) {
    throw new Error("Invalid rule id");
  }

  const existing = await prisma.weeklyOffRule.findUnique({
    where: { id: ruleId },
  });

  if (!existing || !existing.isActive) {
    throw new Error("Rule not found");
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.weeklyOffRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });

    await tx.auditLog.create({
      data: {
        entity: "WEEKLY_OFF",
        entityId: updated.id,
        action: "DEACTIVATED",
        performedById: userId,
      },
    });

    return updated;
  });
}