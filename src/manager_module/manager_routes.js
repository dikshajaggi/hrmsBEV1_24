import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import {getManagerData} from "./manager_controllers.js"

const router = Router();

router.get("/", authenticate, getManagerData);

export default router;
