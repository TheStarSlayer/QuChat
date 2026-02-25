import express from "express";
import { loginController, signupController, 
         refreshController, logoutController } from "../controllers/auth.controller.js";

const authRouter = express.Router();

authRouter.post("/login", loginController);
authRouter.post("/signup", signupController);
authRouter.post("/refresh", refreshController)
authRouter.post("/logout", logoutController);

export default authRouter;