import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";
import mongoose from "mongoose";
import authRouter from "./routes/auth.route.js";

const app = express();
const PORT = 8596;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/auth", authRouter);

app.listen(PORT, () => {
    console.log(`App started on PORT ${PORT}`);
    try {
        mongoose.connect(process.env.MONGODB_CONN);
    }
    catch (err) {
        console.error("Unexpected error occurred: Database could not be connected.");
        console.error(err.message);
    }
});