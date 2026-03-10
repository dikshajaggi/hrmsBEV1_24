import express from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { getAllEmp } from "./emp_controllers.js"


const router = express.Router();

router.get("/", authenticate, getAllEmp);

export default router;