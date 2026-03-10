import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";

export const retrieveOnlineUsers = async (username) => {
    let onlineUsers;
    try {
        onlineUsers = await redisClient.hGetAll("onlineUsers");
        delete onlineUsers[username];
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        onlineUsers = await OnlineUsers.find({ username: { $ne: username } }).project({ _id: 0 });
    }

    return onlineUsers;
}