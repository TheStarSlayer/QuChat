import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";
import { mongoConnect, redisConnect } from "./lib/dbConnect.js";
import authRouter from "./routes/auth.route.js";
import { Server } from "socket.io";
import { ioAuth } from "./middleware/socket.middleware.js";
import { socketConnectEvent, socketDisconnectEvent } from "./lib/socketEventLib.js";

const app = express();
const PORT = 8596;
const io = new Server(8597, {
    cors: {
        origin: ['http://localhost:8596',]
    }
});
let redisClient;

app.use(cors({
    origin: ['http://localhost:8597', 'http://localhost:8595']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/auth", authRouter);

app.listen(PORT, async () => {
    console.log(`App started on PORT ${PORT}`);
    mongoConnect();
    redisClient = await redisConnect();
});

io.use(ioAuth);
io.on("connection", async socket => {
    await socketConnectEvent(socket);
    socket.on("disconnect", () => socketDisconnectEvent(socket));
});

export { redisClient, io };