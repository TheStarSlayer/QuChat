const checkIfOnline = async (userId) => {
    let isOnline = false;

    try {
        isOnline = await redisClient.sIsMember('onlineUsers', userId);
    }
    catch (err) {
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

export default checkIfOnline;