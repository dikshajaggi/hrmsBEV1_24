import express from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { bulkUploadEmployees, getAllEmp } from "./emp_controllers.js"
import multer from "multer";


const router = express.Router();

router.get("/", authenticate, getAllEmp);

//  memory storage (important for buffer processing)
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/bulk-upload",
  authenticate,
  upload.single("file"), // "file" must match frontend key
  bulkUploadEmployees
);

export default router;