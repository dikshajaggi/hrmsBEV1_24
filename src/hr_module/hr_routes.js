import { Router } from "express";
import { approveUser, getPendingUsers, rejectUser } from "./hr_controllers.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

router.get("/pending-users", authenticate, getPendingUsers);
router.post("/approve-user", authenticate, approveUser);
router.post("/reject-user", authenticate, rejectUser);


export default router;
