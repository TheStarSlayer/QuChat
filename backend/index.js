import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";
import { mongoConnect, redisConnect } from "./lib/dbConnect.js";
import authRouter from "./routes/auth.route.js";
import { Server } from "socket.io";

const app = express();
const PORT = 8596;
const io = new Server(8597, {
    cors: {
        origin: ['http://localhost:8596',]
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/auth", authRouter);

// Socket.io event listening
io.on("connection", async socket => {
    const client = await redisConnect();
    socket.on('connect', async userId => {
        await client.set(userId, socket.id);
    });
});

app.listen(PORT, () => {
    console.log(`App started on PORT ${PORT}`);
    mongoConnect();
});