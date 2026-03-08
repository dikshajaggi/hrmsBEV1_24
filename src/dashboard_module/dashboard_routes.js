import { Router } from "express";
import { getDashboard } from "./dashboard_controllers.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

router.get("/", authenticate, getDashboard);

export default router;