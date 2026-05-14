import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";

export const checkIfOnline = async (userId) => {
    let isOnline;

    try {
        isOnline = (await redisClient.zScore('onlineUsers', userId)) !== null;
    }
    catch (err) {
        console.error(err);
        console.error("Unexpected error occurred", err.message);

        try {
            isOnline = await OnlineUsers.exists({ username: userId });
        }
        catch (err) {
            console.error("Unexpected error occurred", err.message);
            return false;
        }
    }

    return isOnline;
};

export const checkIfBusy = async (userId) => {
    let isBusy;

    try {
        isBusy = (await redisClient.zScore('idleUsers', userId)) === null;
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);

        try {
            isBusy = await OnlineUsers.exists({ username: userId, isBusy: true });
        }
        catch (err) {
            console.error("Unexpected error occurred", err.message);
            return false;
        }
    }

    return isBusy;
};

const checkIfAvailable = async (userId) => (
    await checkIfOnline(userId)) && !(await checkIfBusy(userId)
);

export default checkIfAvailable;