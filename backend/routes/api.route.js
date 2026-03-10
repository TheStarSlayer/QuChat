import express from "express";
import {
    persistRequestController, deleteRequestController,
    getAwaitingRequestsController, eavesdropController
} from "../controllers/request.api.controller.js";
import { verifyAccessTokenController } from "../controllers/actions.api.controller.js";

const apiRouter = express.Router();

apiRouter.get("/verify", verifyAccessTokenController);

apiRouter.post("/persistRequest", persistRequestController);
apiRouter.get("/awaitingRequests", getAwaitingRequestsController);
apiRouter.patch("/eavesdrop/:roomId", eavesdropController);
apiRouter.delete("/deleteRequest", deleteRequestController);

export default apiRouter;