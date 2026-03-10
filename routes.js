import express from "express"
import authRoutes from "./src/auth_module/auth_routes.js"
import hrRoutes from "./src/hr_module/hr_routes.js"
import leaveRoutes from "./src/leave_module/leave_routes.js"
import holidayRoutes from "./src/holiday_module/holiday_routes.js"
import weeklyOffRoutes from "./src/weeklyoff_module/weeklyoff_routes.js"
import attendanceRoutes from "./src/attendance_module/attendance_routes.js"
import profileRoutes from "./src/profile_module/profile_routes.js"
import dashboardRoutes from "./src/dashboard_module/dashboard_routes.js"
import managerRoutes from "./src/manager_module/manager_routes.js"
import orgRoutes from "./src/organisation_module/org_routes.js"


const router = express.Router()

router.use("/api/auth", authRoutes)
router.use("/api/hr", hrRoutes)
router.use("/api/leaves", leaveRoutes)
router.use("/api/holidays", holidayRoutes)
router.use("/api/weeklyOff", weeklyOffRoutes)
router.use("/api/attendance", attendanceRoutes)
router.use("/api/profile", profileRoutes)
router.use("/api/dashboard", dashboardRoutes)
router.use("/api/manager", managerRoutes)
router.use("/api/org", orgRoutes)

export default router