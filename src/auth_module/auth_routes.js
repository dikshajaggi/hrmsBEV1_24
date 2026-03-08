import { Router } from "express";
import { register, login, refresh, logout, changePass, activateAccount } from "./auth_controllers.js";
import { authenticate } from "../middlewares/authenticate.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refresh);

// -----------------protected routes--------------
router.post("/logout", authenticate, logout);
router.post("/activate-account", activateAccount);
router.post("/change-password", authenticate, changePass);


export default router;
