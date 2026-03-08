
import prisma from "../../db/db.config.js"

export async function getMyProfile(req, res) {
  try {
    const userId = req.user.id;

   const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
        roles: {
        include: {
            role: true
        }
        },
        employee: {
        include: {
            team: true,
            designation: true,
            manager: {
            include: {
                user: {
                select: {
                    id: true,
                    fullName: true,
                    email: true
                }
                }
            }
            },
            leaveBalances: true   // ✅ correct field name
        }
        }
    }
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Extract role codes
    const roleCodes = user.roles.map(r => r.role.code);

    return res.json({
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        roles: user.roles.map(r => r.role.code),

        employee: user.employee
        ? {
            team: user.employee.team,
            designation: user.employee.designation,
            manager: user.employee.manager?.user || null,
            leaveBalances: user.employee.leaveBalances
        }
        : null
    });

  } catch (error) {
    console.error("PROFILE ERROR:", error);
    return res.status(500).json({ message: "Something went wrong" });
  }
}