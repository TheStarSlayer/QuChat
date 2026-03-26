import { ioAuth } from "./middleware/socket.middleware.js";
import {
    socketConnectEvent, socketDisconnectEvent,
    sendJoinRequestEvent, eavesdropRequestEvent,
    acceptEvent, rejectEvent, joinAckEvent,
    sendMessageEvent, leaveEvent, sessionEndEvent, resetSocketStats,
    updateSocketDataWhenQBERAccepted,
    updateSocketDataWhenAccepted
} from "./lib/socketEventLib.js";

export default socketInit = (io) => {
    io.use(ioAuth);

    io.on("connection", async socket => {
        await socketConnectEvent(socket);

        socket.on("sendJoinRequest", async (receiverId, request) =>
            await sendJoinRequestEvent(socket, receiverId, request));

        socket.on("eavesdropRequest", async roomId =>
            await eavesdropRequestEvent(socket, roomId));

        socket.on("accept", async roomId => await acceptEvent(socket, roomId));

        socket.on("updateOnResponseAccept", roomId => updateSocketDataWhenAccepted(socket, roomId));

        socket.on("reject", async roomId => await rejectEvent(socket, roomId));
        socket.on("joinAck", async (roomId, ack) =>
            await joinAckEvent(socket, roomId, ack));

        socket.on("shareBases", (roomId, bases) =>
            shareBasesEvent(socket, roomId, bases));

        socket.on("calculateQBER", (roomId, subset) =>
            calculateQBEREvent(socket, roomId, subset));

        socket.on("shareQBERResult", (roomId, qberSatisfied) =>
            shareQBERResultEvent(socket, roomId, qberSatisfied));

        socket.on("updateOnQBERAccept", roomId => updateSocketDataWhenQBERAccepted(socket, roomId));

        socket.on("sendMessage", (roomId, encryptedMessage) =>
            sendMessageEvent(socket, roomId, encryptedMessage));

        socket.on("leave", async roomId => await leaveEvent(socket, roomId));
        socket.on("resetSocketStats", () => resetSocketStats(socket));
        socket.on("sessionEnd", roomId => sessionEndEvent(socket, roomId));
        socket.on("disconnect", async () => await socketDisconnectEvent(socket));
    });
};