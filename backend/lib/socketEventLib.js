import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";
import checkIfOnline from "./checkIfOnline.js";
import RequestModel from "../models/requests.model.js";
import finishRequest from "./finishRequest.js";

export const socketConnectEvent = async (socket) => {
    try {
        const loggedAt = Date.now();

        await OnlineUsers.create({
            username: socket.userId,
            loggedAt: loggedAt,
            isBusy: false
        });
        await redisClient.zAdd("onlineUsers", {
            score: loggedAt, value: socket.userId
        });

        socket.chatSession = false;
        socket.requestWaitSession = false;
        socket.eavesdropper = false;

        socket.join(socket.userId);
        socket.broadcast.emit("newUser", socket.userId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
    }
};

export const sendJoinRequestEvent = async (socket, request) => {
    const isReceiverOnline = await checkIfOnline(request.receiver);
    if (!isReceiverOnline)
        return socket.emit("requestFailed", "User is not available for requests"); // If userId = roomId, finishRequest(cancelled), else if eavesdropper, call eavesdropFailed, else leaveEvent is called

    socket.to(request.receiver).emit("requestToJoin", request);
    socket.requestWaitSession = socket.userId;
};

export const eavesdropRequestEvent = async (socket, roomId) => {
    const isSenderOnline = await checkIfOnline(roomId);
    if (!isSenderOnline)
        return socket.emit("requestFailed", "User is not available for requests");

    socket.join(roomId);
    socket.eavesdropper = roomId;
};

export const acceptEvent = async (socket, roomId) => {
    const isSenderOnline = await checkIfOnline(roomId);
    if (!isSenderOnline)
        return socket.emit("requestFailed", "User is not available for requests");

    socket.join(roomId);
    socket.requestWaitSession = roomId;

    socket.to(roomId).emit("response", "accepted");
};

export const rejectEvent = async (socket, roomId) => {
    const isSenderOnline = await checkIfOnline(roomId);
    if (!isSenderOnline)
        return socket.emit("requestFailed", "User is not available for requests");

    socket.to(roomId).emit("response", "rejected"); // Emits leave event
    socket.chatSession = false;
    socket.requestWaitSession = false;
};

export const joinAckEvent = async (socket, roomId, ack) => {
    const isReceiverOnline = await checkIfOnline(roomId);
    if (!isReceiverOnline)
        return socket.emit("requestFailed", "User is not available for requests");

    socket.to(roomId).emit("ack", ack); // Set socket.chatSession & unset socket.requestWaitSession if not eavesdropper
    socket.requestWaitSession = false;
    socket.chatSession = roomId;
};

export const sendMessageEvent = (socket, roomId, encryptedMessage) => {
    socket.to(roomId).emit("message", encryptedMessage);
};

// Event emitted only if roomId != userId
export const leaveEvent = async (socket, roomId) => {
    socket.leave(roomId);
    socket.chatSession = false;
    socket.requestWaitSession = false;
    socket.eavesdropper = false;
};

/**
 * Must handle the following events:
 * - disconnect on idle
 * - disconnect on waiting for request response
 * - disconnect on eavesdropping
 * - disconnect on chat session
 */
export const socketDisconnectEvent = async (socket) => {
    try {
        await OnlineUsers.deleteOne({ username: socket.userId });
        await redisClient.zRem("onlineUsers", socket.userId);

        if (socket.requestWaitSession) {
            socket.to(socket.requestWaitSession).emit("requestFailed", "User disconnected");

            if (socket.userId === socket.requestWaitSession) {
                await finishRequest(socket.userId, "cancelled");
            }
        }

        if (socket.eavesdropper) {
            const senderId = socket.eavesdropper;
            const eavesdropperId = socket.userId;

            try {
                const findFilter = {
                    eavesdropper: true,
                    eavesdropperId: eavesdropperId,
                    sender: senderId,
                    status: "pending"
                };
                const updateFilter = { eavesdropper: false, eavesdropperId: null };

                await RequestModel.findOneAndUpdate(findFilter, updateFilter);

                const createdOn = await redisClient.hGet(`requester:${senderId}`, "createdOn");
                await redisClient.multi()
                    .hSet(`requester:${senderId}`, "eavesdropper", false)
                    .hSet(`requester:${senderId}`, "eavesdropperId", null)
                    .zAdd('EDRequestIndex', { score: createdOn, value: senderId })
                    .exec();
            }
            catch (err) {
                console.error("Unexpected error occurred", err.message);
            }
        }

        if (socket.chatSession) {
            socket.to(socket.chatSession).emit("sessionDisturbed"); // call leave event
        }

        socket.broadcast.emit("userLeft", socket.userId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
    }
};