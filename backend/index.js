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
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const SERVER_PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: [process.env.FRONTEND_ADDR,],
        credentials: true
    }
});
socketInit(io);

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

app.use(cors({
    origin: [process.env.FRONTEND_ADDR,],
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/auth", authRouter);
app.use("/api", apiRouter);

// serve frontend
if (process.env.PROD === "true") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    app.use(express.static(path.join(__dirname, "dist")));

    app.get((_, res) => {
        res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
}

server.listen(SERVER_PORT, () => {
    console.log(`App started on PORT ${SERVER_PORT}`);
});

export { io, redisClient, r2Client };