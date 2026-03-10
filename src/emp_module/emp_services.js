import prisma from "../../db/db.config.js";

export async function getAllEmployees() {
  return prisma.employee.findMany({
    where: {
      status: "ACTIVE"
    },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          gender: true
        }
      },
      team: {
        select: {
          id: true,
          name: true
        }
      },
      designation: {
        select: {
          id: true,
          name: true
        }
      },
      manager: {
        include: {
          user: {
            select: {
              fullName: true
            }
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}