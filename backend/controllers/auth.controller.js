import { User } from "../models/user.model.js";
import checkIfOnline from "../lib/checkIfOnline.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const cookieConfig = {
    httpOnly: true,
    secure: process.env.PROD === "true",
    sameSite: process.env.PROD === "true" ? "none" : "lax",
    path: "/"
};

export const signupController = async (req, res) => {
    try {
        if (req.cookies.refreshToken !== undefined)
            return res.status(400).json({ error: "User is already logged in" });

        const { username, password } = req.body;

        const usernameExists = await User.exists({ username: username });
        if (usernameExists)
            return res.status(400).json({ error: "Username already exists!" });

        const hashedPwd = await bcrypt.hash(password, parseInt(process.env.SALT_ROUNDS));

        await User.create({
            username: username,
            password: hashedPwd,
            refreshToken: null
        });

        return res.status(201).json({
            msg: "User added to database, please log in now to avail services!"
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const loginController = async (req, res) => {
    try {
        const { username, password } = req.body;
        const userDoc = await User.findOne({ username: username });

        if (userDoc === null)
            return res.status(400).json({ error: "Invalid credentials!" });

        const passwordsMatch = await bcrypt.compare(password, userDoc.password);

        if (!passwordsMatch)
            return res.status(400).json({ error: "Invalid credentials!" });

        if (await checkIfOnline(username))
            return res.status(409).json({ error: "User is already logged in" });

        const accessToken = jwt.sign({ userId: username }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: 15 * 60,
            algorithm: "HS256"
        });
        const refreshToken = jwt.sign({ userId: username }, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: "7d",
            algorithm: "HS256"
        });

        userDoc.refreshToken = await bcrypt.hash(refreshToken, parseInt(process.env.SALT_ROUNDS));
        await userDoc.save();
        
        res.cookie("refreshToken", refreshToken, cookieConfig);

        return res.status(200).json({
            msg: "Logged in successfully!",
            accessToken: accessToken
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const refreshController = async (req, res) => {
    try {
        const currRefreshToken = req.cookies.refreshToken;

        if (currRefreshToken === undefined)
            return res.status(401).json({ error: "User must login to avail services!" });

        let payload;
        try {
            payload = jwt.verify(currRefreshToken, process.env.REFRESH_TOKEN_SECRET, {
                algorithms: ["HS256"]
            });
        }
        catch (err) {
            if (err.name === "TokenExpiredError")
                return res.status(401).json({ error: "JWT expired! Re-login to avail services!" });
            return res.status(401).json({ error: "Cannot verify! Re-login to avail services!" });
        }

        const userDoc = await User.findOne({ username: payload.userId });
        if (userDoc.refreshToken === null)
            return res.status(401).json({ error: "Refresh token should not exist! Re-login to avail services!" });

        if (!(await bcrypt.compare(currRefreshToken, userDoc.refreshToken)))
            return res.status(400).json({ error: "Refresh token may be expired. Logout now" });

        const accessToken = jwt.sign({ userId: payload.userId }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: 15 * 60,
            algorithm: "HS256"
        });
        const refreshToken = jwt.sign({ userId: payload.userId }, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: "7d",
            algorithm: "HS256"
        });

        userDoc.refreshToken = await bcrypt.hash(refreshToken, parseInt(process.env.SALT_ROUNDS));
        await userDoc.save();

        res.cookie("refreshToken", refreshToken, cookieConfig);

        return res.status(200).json({
            msg: "Refreshed access token!",
            accessToken: accessToken
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const logoutController = async (req, res) => {
    try {
        const refreshToken = req.cookies.refreshToken;

        if (refreshToken === undefined)
            return res.status(400).json({ error: "Refresh token does not exist. User may already be logged out!" });

        const payload = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, { 
            ignoreExpiration: true,
            algorithms: ["HS256"] 
        });
        const userId = payload.userId;

        res.clearCookie('refreshToken');

        await User.findOneAndUpdate({ username: userId }, { refreshToken: null });

        return res.status(200).json({
            msg: "Logged out"
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};