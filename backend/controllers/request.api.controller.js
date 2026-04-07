import RequestModel from "../models/requests.model.js";
import { redisClient, io } from "../index.js";
import checkIfOnline from "../lib/checkIfOnline.js";
import finishRequest from "../lib/finishRequest.js";

export const persistRequestController = async (req, res) => {
    const { 
        receiverId, timeLimitInMs,
        typeOfEncryption, chatSessionTimeInMin,
        isSimulator 
    } = req.body;

    const senderId = req.userId;

    // Verify if receiver is available for requests
    if (!(await checkIfOnline(receiverId)))
        return res.status(404).json({ msg: "User is not available for requests" });

    // Verify if request already exists
    try {
        if (await redisClient.zScore('allRequestIndex', senderId) !== null)
            return res.status(409).json({ msg: "Request already exists" });
    }
    catch (err) {
        console.error(err);

        try {
            if (await RequestModel.exists({ sender: senderId, status: "pending" }))
                return res.status(409).json({ msg: "Request already exists" });
        }
        catch (err) {
            console.error(err);
            return res.status(500).json({ msg: "Internal server error" });
        }
    }

    const newRequestPublic = {
        sender: senderId,
        receiver: receiverId,
        createdOn: Date.now(),
        timeLimitInMs: timeLimitInMs - 500, // Consider latency
        typeOfEncryption,
        chatSessionTimeInMin,
        isSimulator
    };

    const newRequest = {
        ...newRequestPublic,
        eavesdropper: false,
        eavesdropperId: null,
        status: "pending"
    };

    // Persist request
    try {
        await RequestModel.create(newRequest);

        await redisClient.multi()
            .zAdd('allRequestIndex', { score: newRequestPublic.createdOn, value: senderId })
            .zAdd('EDRequestIndex', { score: newRequestPublic.createdOn, value: senderId })
            .set(`requester:${senderId}`, JSON.stringify(newRequest))
            .zAdd(`requestee:${receiverId}`, { score: newRequestPublic.createdOn, value: senderId })
            .exec();
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ msg: "Internal server error" });
    }

    // Emit request for eavesdropper
    io.emit("requestForED", newRequestPublic);

    return res.status(200).json({
        msg: "Request persisted successfully!",
        newRequestPublic
    });
};

export const getMyActiveRequestsController = async (req, res) => {
    const userId = req.userId;
    let requests = null;

    try {
        const requestIndex = await redisClient.zRange(`requestee:${userId}`, 0, -1, { REV: true });
        
        requests = requestIndex.map(async requester => {
            const request = JSON.parse(await redisClient.get(`requester:${requester}`));
            if (!request) return;
            return {
                sender: request.sender,
                receiver: request.receiver,
                createdOn: request.createdOn,
                isSimulator: request.isSimulator,
                timeLimitInMs: request.timeLimitInMs,
                typeOfEncryption: request.typeOfEncryption,
                chatSessionTimeInMin: request.chatSessionTimeInMin
            };
        });
    }
    catch (err) {
        console.error(err);

        try {
            requests = await RequestModel
                .find({ receiver: userId, status: "pending" })
                .select({ eavesdropper: 0, eavesdropperId: 0, status: 0, _id: 0 })
                .sort({ createdOn: -1 })
                .toArray();
        }
        catch (err) {
            console.error(err);
            return res.status(500).json({ msg: "Internal server error" });
        }
    }

    return res.status(200).json(requests);
};

export const eavesdroppableRequestsController = async (req, res) => {
    let requests = null;

    try {
        const requestIndex = await redisClient.zRange('EDRequestIndex', 0, -1);

        requests = requestIndex
            .map(async requester => {
                const request = JSON.parse(await redisClient.get(`requester:${requester}`));
                return {
                    sender: request.sender,
                    receiver: request.receiver,
                    createdOn: request.createdOn,
                    isSimulator: request.isSimulator,
                    timeLimitInMs: request.timeLimitInMs,
                    typeOfEncryption: request.typeOfEncryption,
                    chatSessionTimeInMin: request.chatSessionTimeInMin
                };
            })
            .filter(request => request.sender !== req.userId && request.receiver !== req.userId);
    }
    catch (err) {
        console.error(err);

        try {
            requests = await RequestModel
                .find({
                    sender: { $ne: req.userId },
                    receiver: { $ne: req.userId },
                    eavesdropper: false, status: "pending"
                })
                .select({ eavesdropper: 0, eavesdropperId: 0, status: 0, _id: 0 })
                .sort({ createdOn: 1 })
                .toArray();
        }
        catch (err) {
            console.error(err);
            return res.status(500).json({ msg: "Internal server error" });
        }
    }
    return res.status(200).json(requests);
};

export const eavesdropController = async (req, res) => {
    const senderId = req.params.roomId;
    const eavesdropperId = req.userId;

    try {
        const findFilter = { sender: senderId, eavesdropper: false, status: "pending" };
        const updateFilter = { eavesdropper: true, eavesdropperId: eavesdropperId };

        const request = await RequestModel.findOneAndUpdate(findFilter, updateFilter);
        if (request === null)
            return res.status(404).json({ msg: "Cannot eavesdrop on this chat" });

        const updatedRequest = JSON.parse(await redisClient.get(`requester:${senderId}`));
        updatedRequest.eavesdropper = true;
        updatedRequest.eavesdropperId = eavesdropperId;

        await redisClient.multi()
            .set(`requester:${senderId}`, JSON.stringify(updatedRequest))
            .zRem('EDRequestIndex', senderId)
            .exec();
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ msg: "Internal server error" });
    }

    io.emit("removeRequestForED", senderId);
    return res.status(200).json({ msg: "Eavesdropped successfully" });
};

export const finishRequestController = async (req, res) => {
    const userId = req.userId;
    const finishStatus = req.body.finishStatus;
    console.log(finishStatus);
    const result = await finishRequest(userId, finishStatus);
    if (result)
        return res.status(204);
    return res.status(500).json({ msg: "Internal server error" });
};