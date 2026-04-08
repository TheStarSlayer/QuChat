import { ioAuth } from "./middleware/socket.middleware.js";
import {
    socketConnectEvent, socketDisconnectEvent,
    sendJoinRequestEvent, eavesdropRequestEvent,
    acceptEvent, rejectEvent, joinAckEvent,
    sendMessageEvent, leaveEvent, sessionEndEvent, resetSocketStats,
    updateSocketDataWhenQBERAccepted,
    updateSocketDataWhenAccepted, updateSocketDataWhenAcceptedQC,
    sessionDisturbedEvent, shareBasesEvent,
    calculateQBEREvent, shareQBERResultEvent
} from "./lib/socketEventLib.js";

const socketInit = (io) => {
    io.use(ioAuth);

    io.on("connection", async socket => {
        await socketConnectEvent(socket);

        socket.on("sendJoinRequest", async (request) =>
            await sendJoinRequestEvent(socket, request));

        socket.on("eavesdropRequest", async roomId =>
            await eavesdropRequestEvent(socket, roomId));

        socket.on("accept", async (roomId, typeOfEncryption) => await acceptEvent(socket, roomId, typeOfEncryption));
        
        socket.on("updateOnResponseAccept", roomId => updateSocketDataWhenAccepted(socket, roomId));
        socket.on("updateOnResponseAcceptQC", roomId => updateSocketDataWhenAcceptedQC(socket, roomId));

        socket.on("reject", async roomId => await rejectEvent(socket, roomId));
        socket.on("joinAck", (roomId, ack) => joinAckEvent(socket, roomId, ack));

        socket.on("shareBases", (roomId, bases) =>
            shareBasesEvent(socket, roomId, bases));

        socket.on("calculateQBER", (roomId, subset) =>
            calculateQBEREvent(socket, roomId, subset));

        socket.on("shareQBERResult", (roomId, qber) =>
            shareQBERResultEvent(socket, roomId, qber));

        socket.on("updateOnQBERAccept", roomId => updateSocketDataWhenQBERAccepted(socket, roomId));

        socket.on("sendMessage", (roomId, message) =>
            sendMessageEvent(socket, roomId, message));

        socket.on("leave", roomId => leaveEvent(socket, roomId));
        socket.on("resetSocketStats", () => resetSocketStats(socket));
        socket.on("sessionDisturbed", (roomId, message) => sessionDisturbedEvent(socket, roomId, message));
        socket.on("sessionEnd", roomId => sessionEndEvent(socket, roomId));
        socket.on("disconnect", async () => await socketDisconnectEvent(socket));
    });
};

export default socketInit;