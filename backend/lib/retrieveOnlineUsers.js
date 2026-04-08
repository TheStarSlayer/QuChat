import { redisClient } from "../index.js";
import { OnlineUsers } from "../models/user.model.js";

const retrieveOnlineUsers = async (currUserId) => {
    let onlineUsers;
    try {
        const onlineUsersObj = await redisClient.zRange("onlineUsers", 0, -1, { REV: true });
        onlineUsers = onlineUsersObj.filter(username => username !== currUserId)
            
    }
    catch (err) {
        console.error(err);

        try {
            onlineUsers = await OnlineUsers
                .find({ username: { $ne: currUserId }, isBusy: false })
                .sort({ loggedAt: -1 })
                .select({ username: 1, _id: 0 })
                .toArray()
                .map(user => user.username);
        }
        catch (err) {
            console.error(err);
            return null;
        }
    }

    return onlineUsers.map(username => {
        const profilePicAvtr = username[0].toLowerCase() + username[1].toLowerCase()
        return { username: username, profilePicture: `https://cdn.auth0.com/avatars/${profilePicAvtr}.png`};
    });;
}

export default retrieveOnlineUsers;