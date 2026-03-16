import { Server } from "socket.io";
import { ioAuth } from "./middleware/socket.middleware.js";
import { socketConnectEvent, socketDisconnectEvent } from "./lib/socketEventLib.js";

const IO_PORT = 8597;

const io = new Server(IO_PORT, {
    cors: {
        origin: ['http://localhost:8595', 'http://localhost:8596']
    }
});
io.use(ioAuth);
io.on("connection", async socket => {
    await socketConnectEvent(socket);
    socket.on("joinRoom", async (receiverId, request) => await sendJoinRequest(socket, receiverId, request));
    socket.on("accept", async roomId => await acceptEvent(socket, roomId));
    socket.on("reject", async roomId => await rejectEvent(socket, roomId));
    socket.on("sendMessage", (roomId, encryptedMessage) => sendMessageEvent(socket, roomId, encryptedMessage));
    socket.on("disconnect", () => socketDisconnectEvent(socket));
});

export default io;