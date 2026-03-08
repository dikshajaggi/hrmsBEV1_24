import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { getMyProfile } from "./profile_controllers.js";

const router = Router();

router.get("/me", authenticate, getMyProfile);

export default router;