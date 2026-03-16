import io from "../io.index.js";
import RequestModel from "../models/requests.model.js";
import { redisClient } from "../index.js";

const finishRequest = async (userId, finishStatus) => {
    try {
        const findFilter = { sender: userId, status: "pending" };
        const updateFilter = { status: finishStatus };

        const request = await RequestModel.findOneAndUpdate(findFilter, updateFilter);
        if (request === null)
            return res.status(404).json({ msg: "Request from this user does not exist" });

        const requestee = await redisClient.hGet(`requester:${userId}`, receiver);
        await redisClient.multi()
            .zRem('allRequestIndex', userId)
            .zRem('EDRequestIndex', userId)
            .del(`requester:${userId}`)
            .zRem(`requestee:${requestee}`, userId)
            .exec();

        io.emit("removeRequest", userId);
        return true;
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return false;
    }
}

export default finishRequest;