import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";

const retrieveOnlineUsers = async (currUserId) => {
    let onlineUsers;
    try {
        const onlineUsersObj = await redisClient.zRange("onlineUsers", 0, -1, { REV: true });
        onlineUsers = onlineUsersObj.filter(username => username !== currUserId);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);

        try {
            onlineUsers = await OnlineUsers
                .find({ username: { $ne: currUserId }, isBusy: false })
                .sort({ loggedAt: -1 })
                .select({ username: 1, _id: 0 })
                .toArray()
                .map(user => user.username);
        }
        catch (err) {
            console.error("Unexpected error occurred", err.message);
            return null;
        }
    }

    return onlineUsers;
}

export default retrieveOnlineUsers;