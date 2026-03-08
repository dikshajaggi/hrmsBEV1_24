
import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import * as HolidayController from "./holiday_controllers.js"

const router = Router();

router.post("/", authenticate, HolidayController.createHoliday);
router.get("/", authenticate, HolidayController.getHolidays);
router.delete("/:id", authenticate, HolidayController.deleteHoliday);

export default router;
