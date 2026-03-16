import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";

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
    try {
        const isReceiverOnline = await redisClient.sIsMember('onlineUsers', request.receiver);
        if (!isReceiverOnline)
            return socket.emit("requestFailed", "User is not available for requests");

        socket.to(request.receiver).emit("requestToJoin", request);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);

        try {
            const isReceiverOnline = await OnlineUsers.exists({ username: request.receiver });

            if (!isReceiverOnline)
                return socket.emit("requestFailed", "User is not available for requests");

            socket.to(request.receiver).emit("requestToJoin", request);
        }
        catch (err) {
            console.error("Unexpected error occurred", err.message);
            return socket.emit("requestFailed", "Unexpected error occurred");
        }
    }
};

export const acceptEvent = (socket, roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("response", "accepted");
};

export const rejectEvent = (socket, roomId) => {
    socket.to(roomId).emit("response", "rejected");
};

export const sendMessageEvent = (socket, roomId, encryptedMessage) => {
    socket.to(roomId).emit(encryptedMessage);
};

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