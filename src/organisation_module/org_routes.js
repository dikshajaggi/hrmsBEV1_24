import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { getDesginationData, getTeamData } from "./org_controllers.js";

const router = Router();

router.get("/teams", authenticate, getTeamData);
router.get("/designations", authenticate, getDesginationData);

export default router;
