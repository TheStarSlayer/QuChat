import express from "express";

const apiRouter = express.Router();

apiRouter.get("/onlineUsers", getOnlineUsers);

export default apiRouter;