import jwt from "jsonwebtoken";
import checkIfOnline from "../lib/checkIfOnline.js";

export const ioAuth = async (socket, next) => {
    const token = socket.handshake.auth.token;

    try {
        const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
            algorithms: ["HS256"]
        });
        const userId = payload.userId;

        if (await checkIfOnline(userId))
            throw new Error("User already exists!");

        socket.userId = userId;
        next();
    }
    catch (err) {
        console.error(err.message);
        next(err);
    }
}