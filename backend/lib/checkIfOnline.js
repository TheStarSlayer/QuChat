import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";

const checkIfOnline = async (userId) => {
    let isOnline = false;

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
        console.error(err);

            console.error("Unexpected error occurred", err.message);
            return false;
        }
    }

    return isOnline;
};

export default checkIfOnline;