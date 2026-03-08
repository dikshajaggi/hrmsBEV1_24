import { Router } from "express";
import { actionByHr, actionByManager, applyLeaves, cancelLeaveController, getAllLeaves, updateLeaveController } from "./leave_controllers.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

router.post("/", authenticate, applyLeaves);
router.get("/", authenticate, getAllLeaves);
router.patch("/:id/manager-action", authenticate, actionByManager);
router.patch("/:id/hr-action", authenticate, actionByHr);
router.patch("/:id/cancel", authenticate, cancelLeaveController);
router.patch("/:id/update", authenticate, updateLeaveController);

export default router;
