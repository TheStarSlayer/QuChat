import RequestModel from "../models/requests.model.js";
import { redisClient } from "../index.js";
import io from "../io.index.js";
import { OnlineUsers } from "../models/user.model.js";

export const persistRequestController = async (req, res) => {
    const { receiverId, createdOn, timeLimitInSec } = req.body;
    const senderId = req.userId;
    let roomId = null;

    // Verify if receiver is available for requests
    try {
        if (!(await redisClient.hExists('onlineUsers', receiverId)))
            return res.status(404).json({ msg: "User is not available for requests" });
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);

        try {
            if (await OnlineUsers.exists({ username: receiverId, isBusy: true }))
                return res.status(404).json({ msg: "User is not available for requests" });
        }
        catch (err) {
            console.error("Unexpected error occurred", err.message);
            return res.status(500).json({ msg: "Internal server error" });
        }
    }

    // Verify if request already exists
    try {
        if (await redisClient.zScore('requestIndex', senderId) !== null)
            return res.status(409).json({ msg: "Request already exists" });

        roomId = await redisClient.hGet("onlineUsers", senderId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);

        try {
            if (await RequestModel.exists({ sender: senderId, status: "pending" }))
                return res.status(409).json({ msg: "Request already exists" });

            roomId = (await OnlineUsers.findOne({ username: senderId }).select({ socketId: 1, _id: 0 })).socketId;
        }
        catch (err) {
            console.error("Unexpected error occurred", err.message);
            return res.status(500).json({ msg: "Internal server error" });
        }
    }

    const newRequestForED = {
        sender: senderId,
        receiver: receiverId,
        roomId,
        createdOn,
        timeLimitInSec
    };

    const newRequest = {
        ...newRequestForED,
        eavesdropper: false,
        eavesdropperId: null,
        status: "pending"
    };

    // Persist request
    try {
        await RequestModel.create(newRequest);

        await redisClient.multi()
            .zAdd('allRequestIndex', { score: createdOn.getTime(), value: senderId })
            .zAdd('EDRequestIndex', { score: createdOn.getTime(), value: senderId })
            .hSet(`requester:${senderId}`, newRequest)
            .zAdd(`requestee:${receiverId}`, { score: createdOn.getTime(), value: senderId })
            .exec();
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return res.status(500).json({ msg: "Internal server error" });
    }

    // Emit request for eavesdropper
    io.emit("requestForED", newRequestForED);

    return res.status(200).json({
        msg: "Request persisted successfully!"
    });
};

export const getRequestsToMeController = async (req, res) => {
    const userId = req.userId;
    let requests = null;

    try {
        const requestIndex = await redisClient.zRange(`requestee:${userId}`, 0, -1);
        requests = requestIndex.map(async requester => {
            const request = await redisClient.hGetAll(`requester:${requester}`);
            return {
                sender: request.sender,
                receiver: request.receiver,
                roomId: request.roomId,
                createdOn: request.createdOn,
                timeLimitInSec: request.timeLimitInSec
            };
        });
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);

        try {
            requests = await RequestModel
                .find({ receiver: userId, status: "pending" })
                .select({ eavesdropper: 0, eavesdropperId: 0, status: 0, _id: 0 })
                .sort({ createdOn: 1 })
                .toArray();
        }
        catch (err) {
            console.error("Unexpected error occurred", err.message);
            return res.status(500).json({ msg: "Internal server error" });
        }
    }

    return res.status(200).json(requests);
};

export const eavesdroppableRequestsController = async (_, res) => {
    let requests = null;

    try {
        const requestIndex = await redisClient.zRange('EDRequestIndex', 0, -1);

        requests = requestIndex.map(async requester => {
            const request = await redisClient.hGetAll(`requester:${requester}`);
            return {
                sender: request.sender,
                receiver: request.receiver,
                roomId: request.roomId,
                createdOn: request.createdOn,
                timeLimitInSec: request.timeLimitInSec
            };
        });
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);

        try {
            requests = await RequestModel
                .find({ eavesdropper: false, status: "pending" })
                .select({ eavesdropper: 0, eavesdropperId: 0, status: 0, _id: 0 })
                .sort({ createdOn: 1 })
                .toArray();
        }
        catch (err) {
            console.error("Unexpected error occurred", err.message);
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

        await redisClient.multi()
            .hSet(`requester:${senderId}`, "eavesdropper", true)
            .hSet(`requester:${senderId}`, "eavesdropperId", eavesdropperId)
            .zRem('EDRequestIndex', senderId)
            .exec();
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return res.status(500).json({ msg: "Internal server error" });
    }

    io.emit("removeRequest", senderId);
    return res.status(200).json({ msg: "Eavesdropped successfully" });
};

export const finishRequestController = async (req, res) => {
    const userId = req.userId;
    const finishStatus = req.body.finishStatus;

    try {
        const findFilter = { sender: userId, status: "pending" };
        const updateFilter = { status: finishStatus };

        const request = await RequestModel.findOneAndUpdate(findFilter, updateFilter);
        if (request === null)
            return res.status(404).json({ msg: "Request from this user does not exist" });

        const requestee = await redisClient.hGet(`requester:${userId}`, receiver);
        await redisClient.multi()
            .zRem('allRequestIndex', userId)
            .zRem('EDRequestIndex', userId)
            .del(`requester:${userId}`)
            .zRem(`requestee:${requestee}`, userId)
            .exec();

        io.emit("removeRequest", userId);
        return res.status(204);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return res.status(500).json({ msg: "Internal server error" });
    }
};