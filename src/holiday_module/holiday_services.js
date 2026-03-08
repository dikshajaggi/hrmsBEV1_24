import prisma from "../../db/db.config.js";
import dayjs from "../utils/date.js"

export async function getHolidays(year) {
  if (!year || isNaN(year)) {
    throw new Error("Valid year required");
  }

  const start = dayjs(`${year}-01-01`).utc().startOf("year").toDate();
  const end = dayjs(`${year}-12-31`).utc().endOf("year").toDate();

  return prisma.holiday.findMany({
    where: {
      date: { gte: start, lte: end },
      isActive: true,
    },
    orderBy: { date: "asc" },
  });
}


export async function createHoliday(data) {
  const { date, name } = data;

  if (!date || !name) {
    throw new Error("Date and name required");
  }

  const formattedDate = dayjs(date).utc().startOf("day");

  if (formattedDate.isBefore(dayjs().utc(), "day")) {
    throw new Error("Cannot create holiday in past");
  }

  const existing = await prisma.holiday.findUnique({
    where: { date: formattedDate.toDate() },
  });

  // 🔥 If exists but inactive → reactivate
  if (existing) {
    if (!existing.isActive) {
      return prisma.holiday.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          name,
        },
      });
    }

    throw new Error("Holiday already exists for this date");
  }

  return prisma.holiday.create({
    data: {
      date: formattedDate.toDate(),
      name,
      isActive: true,
    },
  });
}

export async function deleteHoliday(id) {
  const holiday = await prisma.holiday.findUnique({
    where: { id: Number(id) },
  });

  if (!holiday || !holiday.isActive) {
    throw new Error("Holiday not found");
  }

  return prisma.holiday.update({
    where: { id: Number(id) },
    data: { isActive: false },
  });
}