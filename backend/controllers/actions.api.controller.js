import retrieveOnlineUsers from "../lib/retrieveOnlineUsers.js";
import { redisClient } from "../index.js";
import io from "../io.index.js";
import { OnlineUsers } from "../models/user.model.js";

export const verifyAccessTokenController = (_, res) => {
    return res.status(200).json({ msg: "Access token verified successfully!" });
};

export const getOnlineUsersController = async (_, res) => {
    const onlineUsers = await retrieveOnlineUsers();
    if (onlineUsers === null)
        return res.status(500).json({ error: "Internal Server Error" });
    return res.status(200).json({ onlineUsers });
}

export const setToBusyController = async (req, res) => {
    const userId = req.userId;

    try {
        await redisClient.hSet('onlineUsers', userId, true);
        await OnlineUsers.updateOne({ username: userId }, { isBusy: true });

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
        await redisClient.hSet('onlineUsers', userId, false);
        await OnlineUsers.updateOne({ username: userId }, { isBusy: false });

        io.emit('newUser', userId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }

    return res.status(200).json({ msg: "User set to available successfully!" });
};