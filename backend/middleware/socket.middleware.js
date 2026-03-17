import jwt from "jsonwebtoken";
import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";

export const ioAuth = async (socket, next) => {
    const token = socket.handshake.auth.token;

    try {
        const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const userId = payload.userId;

        let userExists;
        try {
            userExists = await redisClient.sIsMember("onlineUsers", userId);
        }
        catch (err) {
            console.error("Unexpected error occurred", err.message);
            userExists = await OnlineUsers.exists({ username: userId });
        }

        if (userExists)
            throw new Error("User already exists!");

        socket.userId = userId;
        next();
    }
    catch (err) {
        next(err);
    }
}