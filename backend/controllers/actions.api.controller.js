import retrieveOnlineUsers from "../lib/retrieveOnlineUsers.js";
import { redisClient } from "../index.js";
import io from "../io.index.js";
import { OnlineUsers } from "../models/user.model.js";

export const verifyAccessTokenController = (_, res) => {
    return res.status(200).json({ msg: "Access token verified successfully!" });
};

export const getOnlineUsersController = async (req, res) => {
    const onlineUsers = await retrieveOnlineUsers(req.userId);
    if (onlineUsers === null)
        return res.status(500).json({ error: "Internal Server Error" });
    return res.status(200).json({ onlineUsers });
}

export const setToBusyController = async (req, res) => {
    const userId = req.userId;

    try {
        await OnlineUsers.updateOne({ username: userId }, { isBusy: true });
        await redisClient.zRem("onlineUsers", userId);

        io.emit('userLeft', userId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }

    return res.status(200).json({ msg: "User set to busy successfully!" });
}

export const setToAvailableController = async (req, res) => {
    const userId = req.userId;

    try {
        await OnlineUsers.updateOne({ username: userId }, { isBusy: false, loggedAt: Date.now() });
        await redisClient.zAdd("onlineUsers", { score: Date.now(), value: userId });

        io.emit('newUser', userId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }

    return res.status(200).json({ msg: "User set to available successfully!" });
};