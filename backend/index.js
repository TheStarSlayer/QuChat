import express from "express";
import cookieParser from "cookie-parser";
import "dotenv/config";

const app = express();
const PORT = 8596;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.listen(PORT, () => {
    console.log(`App started on PORT ${PORT}`);
});