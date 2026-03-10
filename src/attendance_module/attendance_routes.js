import { Router } from "express";
import * as AttendanceController from "./attendance_controllers.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

router.get("/sheet", authenticate, AttendanceController.getSheet);
router.post("/mark", authenticate, AttendanceController.markAttendance);
router.delete("/remove", authenticate, AttendanceController.removeAttendance);
router.post("/bulk", authenticate, AttendanceController.bulkMarkAttendance);

export default router;
