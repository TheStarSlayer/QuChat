import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";
import mongoose from "mongoose";

const app = express();
const PORT = 8596;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.listen(PORT, () => {
    console.log(`App started on PORT ${PORT}`);
    try {
        mongoose.connect(process.env.MONGODB_CONN);
    }
    catch (err) {
        console.log("Unexpected error occurred: Database could not be connected.");
        console.error(err);
    }
});