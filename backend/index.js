import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";
import { mongoConnect, redisConnect } from "./lib/dbConnect.js";
import authRouter from "./routes/auth.route.js";
import apiRouter from "./routes/api.route.js";
import socketInit from "./io.index.js";
import { Server } from "socket.io";
import cors from "cors";
import { S3Client } from "@aws-sdk/client-s3";

const SERVER_PORT = 8596;
const IO_PORT = 8597;

const app = express();

const io = new Server(IO_PORT, {
    cors: {
        origin: [process.env.FRONTEND_ADDR, process.env.SERVER_ADDR]
    }
});

const redisClient = await redisConnect();
mongoConnect();
const r2Client = new S3Client({
    region: "auto", 
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(cors({
    origin: [process.env.FRONTEND_ADDR, process.env.IO_ADDR],
    credentials: true
}));

app.use("/auth", authRouter);
app.use("/api", apiRouter);

socketInit(io);

app.listen(SERVER_PORT, () => {
    console.log(`App started on PORT ${SERVER_PORT}`);
});

export { io, redisClient, r2Client };