import express from "express";
import { loginController, signupController, logoutController } from "../controllers/auth.controller.js";

const authRoute = express.Router();

// TODO: Implement these controllers!
authRoute.post("/login", loginController);
authRoute.post("/signup", signupController);
authRoute.get("/logout", logoutController);

export default authRoute;