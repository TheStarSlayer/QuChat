import RequestModel from "../models/requests.model.js";
import { io } from "../index.js";

export const persistRequestController = async (req, res) => {
    const { receiverId, createdOn, roomId } = req.body;
    try {
        const newRequest = {
            sender: req.userId,
            receiver: receiverId,
            createdOn: createdOn,
            eavesdropper: false,
            eavesdropperId: null,
            roomId: roomId
        };

        await RequestModel.create(newRequest);
        io.emit("newRequest", newRequest);

        return res.status(200).json({
            msg: "Request persisted successfully!"
        });
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return res.status(500).json({ msg: "Internal server error" });
    }
};

export const getAwaitingRequestsController = async (_, res) => {
    const requests = await RequestModel.find({ eavesdropper: false }).sort({ createdOn: 1 });
    return res.status(200).json(requests);
};

export const eavesdropController = async (req, res) => {
    const roomId = req.params.roomId;
    const eavesdropperId = req.userId;
    try {
        const findFilter = { roomId: roomId, eavesdropper: false };
        const updateFilter = { eavesdropper: true, eavesdropperId: eavesdropperId };

        const request = await RequestModel.findOneAndUpdate(findFilter, updateFilter);
        if (request === null)
            return res.status(404).json({ msg: "Cannot eavesdrop on this chat" });

        io.emit("removeRequest", request._id);
        return res.status(200).json({ msg: "Eavesdropped successfully" });
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return res.status(500).json({ msg: "Internal server error" });
    }
};

export const deleteRequestController = async (req, res) => {
    const roomId = req.body.roomId;
    const userId = req.userId;

    try {
        const deletedRequest = await RequestModel.findOneAndDelete({ sender: userId, roomId: roomId });
        io.emit("removeRequest", deletedRequest._id);
        return res.status(204);
    }
    catch (err) {
        console.error("Unexpected error occurred", err.message);
        return res.status(500).json({ msg: "Internal server error" });
    }
};