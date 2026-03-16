import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";
import checkIfOnline from "./checkIfOnline.js";

export const socketConnectEvent = async (socket) => {
    try {
        await OnlineUsers.create({
            username: socket.userId,
            isBusy: false
        });
        await redisClient.sAdd("onlineUsers", socket.userId);

        socket.join(socket.userId);
        socket.broadcast.emit("newUser", socket.userId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
    }
};

export const sendJoinRequest = async (socket, request) => {
    const isReceiverOnline = await checkIfOnline(request.receiver);
    if (!isReceiverOnline)
        return socket.emit("requestFailed", "User is not available for requests");

    socket.to(request.receiver).emit("requestToJoin", request);
};

export const acceptEvent = async (socket, roomId) => {
    const isSenderOnline = await checkIfOnline(roomId);
    if (!isSenderOnline)
        return socket.emit("requestFailed", "User is not available for requests");

    socket.join(roomId);
    socket.to(roomId).emit("response", "accepted");
};

export const rejectEvent = async (socket, roomId) => {
    const isSenderOnline = await checkIfOnline(roomId);
    if (!isSenderOnline)
        return socket.emit("requestFailed", "User is not available for requests");

    socket.to(roomId).emit("response", "rejected");
};

export const sendMessageEvent = (socket, roomId, encryptedMessage) => {
    socket.to(roomId).emit(encryptedMessage);
};

/**
 * Must handle the following events:
 * - disconnect on idle
 * - disconnect on waiting state (request, key generation)
 * - disconnect on chat session
 */
export const socketDisconnectEvent = async (socket) => {
    try {
        await OnlineUsers.deleteOne({ username: socket.userId });
        await redisClient.hDel("onlineUsers", socket.userId);
        socket.broadcast.emit("userLeft", socket.userId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
    }
};