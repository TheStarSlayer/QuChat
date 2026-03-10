import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";

export const socketConnectEvent = async (socket) => {
    socket.broadcast.emit("newUser", {
        username: socket.userId,
        socketId: socket.id
    });

    try {
        await redisClient.hSet("onlineUsers", socket.userId, socket.id);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
    }
    finally {
        await OnlineUsers.create({
            username: socket.userId,
            socketId: socket.id
        });
    }
};

export const socketDisconnectEvent = async (socket) => {
    socket.broadcast.emit("userLeft", socket.userId);

    try {
        await redisClient.hDel("onlineUsers", socket.userId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
    }
    finally {
        await OnlineUsers.deleteOne({ username: socket.userId });
    }
};