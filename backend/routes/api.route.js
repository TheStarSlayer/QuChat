import express from "express";

import {
    persistRequestController, getMyActiveRequestsController, finishRequestController,
    eavesdroppableRequestsController, eavesdropController
} from "../controllers/request.api.controller.js";

import {
    getOnlineUsersController, verifyAccessTokenController,
    setToBusyController, setToAvailableController
} from "../controllers/actions.api.controller.js";

import { 
    deleteObjectsController, getDownloadLinkController, getUploadLinkController
} from "../controllers/file.api.controller.js";

import { apiVerify } from "../middleware/api.middleware.js";

const apiRouter = express.Router();

apiRouter.use(apiVerify);

apiRouter.get("/verify", verifyAccessTokenController);
apiRouter.get("/getOnlineUsers", getOnlineUsersController);
apiRouter.patch("/setToBusy", setToBusyController);
apiRouter.patch("/setToAvailable", setToAvailableController);

apiRouter.post("/persistRequest", persistRequestController);
apiRouter.get("/getMyActiveRequests", getMyActiveRequestsController);
apiRouter.get("/getEavesdroppableRequests", eavesdroppableRequestsController);
apiRouter.patch("/eavesdrop/:roomId", eavesdropController);
apiRouter.patch("/finishRequest", finishRequestController);

apiRouter.delete("/deleteObjects", deleteObjectsController);
apiRouter.get("/getUploadLink", getUploadLinkController);
apiRouter.get("/getDownloadLink", getDownloadLinkController);

export default apiRouter;