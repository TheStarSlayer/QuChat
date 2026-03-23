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
        socket.responseWaitSession = false;
        socket.ackWaitSession = false;
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
        return socket.emit("requestFailed", "User is not available for requests"); // call finishRequest(cancelled)

    socket.to(request.receiver).emit("requestToJoin", request);
    socket.responseWaitSession = socket.userId;
};

export const eavesdropRequestEvent = async (socket, roomId) => {
    const isSenderOnline = await checkIfOnline(roomId);
    if (!isSenderOnline)
        return socket.emit("requestFailed", "Host is not available");

    socket.join(roomId);
    socket.eavesdropper = roomId;
};

export const acceptEvent = async (socket, roomId) => {
    const isSenderOnline = await checkIfOnline(roomId);
    if (!isSenderOnline)
        return socket.emit("requestFailed", "Host is not available");

    socket.join(roomId);
    socket.ackWaitSession = roomId;

    socket.to(roomId).emit("response", "accepted");
};

export const rejectEvent = async (socket, roomId) => {
    const isSenderOnline = await checkIfOnline(roomId);
    if (!isSenderOnline)
        return socket.emit("requestFailed", "Host is not available");

    socket.to(roomId).emit("response", "rejected"); // sender calls finishRequest(rejected)
};

// Sender checks validity of request and sends ack (true or false)
export const joinAckEvent = async (socket, roomId, ack) => {
    const isReceiverOnline = await checkIfOnline(roomId);
    if (!isReceiverOnline)
        return socket.emit("requestFailed", "User is not available for requests"); // call finishRequest(cancelled)

    /**
     * For receivers:
     * 
     *  If ack = true:
     *   Set socket.chatSession & unset socket.ackWaitSession if not eavesdropper
     * 
     *  If ack = false:
     *   Leave room
     */
    socket.to(roomId).emit("ack", ack);

    if (!ack)
        return resetSocketStats(socket);

    socket.responseWaitSession = false;
    socket.chatSession = roomId;
};

// First call by receiver only, then sender in response to receiver
export const shareBasesEvent = (socket, roomId, bases) => {
    socket.to(roomId).emit("bases", {
        bases: bases,
        sender: socket.userId
    });
};

// Emitted by sender only
export const calculateQBEREvent = (socket, roomId, subset) => {
    // subset : { randIndex: [], randReceiverKey: [] }
    socket.to(roomId).emit("qber", subset);
};

// Emitted by receiver only
export const shareQBERResultEvent = (socket, roomId, qberSatisfied) => {
    socket.to(roomId).emit("qberResult", qberSatisfied);
}

export const sendMessageEvent = (socket, roomId, message) => {
    socket.to(roomId).emit("message", {
        message: message,
        sender: socket.userId
    });
};

export const sessionEndEvent = (socket, roomId) => {
    socket.to(roomId).emit("sessionEnd");
    resetSocketStats(socket);
}

// Event emitted only if roomId != userId and requestFailed is called (or response is rejected for eavesdropper)
export const leaveEvent = async (socket, roomId) => {
    socket.leave(roomId);
    resetSocketStats(socket);
};

// Called when roomId == userId
export const resetSocketStats = socket => {
    socket.chatSession = false;
    socket.responseWaitSession = false;
    socket.ackWaitSession = false;
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

        if (socket.responseWaitSession) {
            socket.to(socket.userId).emit("requestFailed", "Host disconnected");
            socket.to(socket.responseWaitSession).emit("requestFailed", "Host disconnected");
            await finishRequest(socket.userId, "cancelled");
        }

        if (socket.ackWaitSession) {
            socket.to(socket.ackWaitSession).emit("requestFailed", "Receiver disconnected");
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