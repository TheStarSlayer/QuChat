import User from "../models/user.model";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const verifyStateController = async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken === null)
        return res.status(401).json({ error: "User must login to avail services!" });

    try {
        const currRefreshToken = req.cookies.refreshToken;
        let payload;

        try {
            payload = jwt.verify(currRefreshToken, process.env.REFRESH_TOKEN_SECRET);    
        }
        catch (err) {
            if (err.name === "TokenExpiredError") {
                return res.status(401).json({ error: "JWT expired! Re-login to avail services!" });
            }
            return res.status(401).json({ error: "Cannot verify! Re-login to avail services!" });
        }

        const userDoc = await User.findById(payload.userId);
        if (userDoc.refreshToken === null)
            return res.status(401).json({ error: "Refresh token should not exist! Re-login to avail services!" });
        
        if (!(await bcrypt.compare(currRefreshToken, userDoc.refreshToken)))
            return res.status(400).json({ error: "Refresh token may be expired. Logout now" });

        return res.status(202).json({ msg: "User may attempt to refresh their access token" });
    }
    catch (err) {
        console.error("Unexpeted error occurred: ", err.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const signupController = async (req, res) => {
    try {
        const { username, password } = req.body;
        const usernameExists = !!(await User.exists({ username: username }));

        if (usernameExists)
            return res.status(400).json({ error: "Username already exists!" });

        const pfpLink = `https://cdn.auth0.com/avatars/${username[0] + username[1]}.png`
        const hashedPwd = await bcrypt.hash(password, process.env.SALT_ROUNDS);

        const newUser = await User.create({
            username: username,
            password: hashedPwd,
            profilePic: pfpLink, 
            currentlyActive: false
        });

        return res.status(201).json({
            id: newUser._id,
            msg: "User added to database, please log in now to avail services!"
        });
    }
    catch (err) {
        console.error("Unexpeted error occurred: ", err.message);
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
        
        const accessToken = jwt.sign({ userId: userDoc._id }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: 15 * 60
        });
        const refreshToken = jwt.sign({ userId: userDoc._id }, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: "7d"
        });
        userDoc.refreshToken = await bcrypt.hash(refreshToken, process.env.SALT_ROUNDS);
        userDoc.currentlyActive = true;

        await userDoc.save();
        
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.PROD === "true" ? true : false,
            sameSite: "strict",
            path: "/auth"
        });

        return res.status(200).json({
            msg: "Logged in successfully!",
            userId: userDoc._id,
            accessToken: accessToken
        });
    }
    catch (err) {
        console.error("Unexpeted error occurred: ", err.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const refreshController = async (_, res) => {
    try {
        const accessToken = jwt.sign({ userId: userDoc._id }, process.env.ACCESS_TOKEN_SECRET, {
            expiresIn: 15 * 60
        });
        const refreshToken = jwt.sign({ userId: userDoc._id }, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: "7d"
        });
        userDoc.refreshToken = await bcrypt.hash(refreshToken, process.env.SALT_ROUNDS);
        userDoc.currentlyActive = true;

        await userDoc.save();
        
        res.cookie("refreshToken", refreshToken, {
            httpOnly: true,
            secure: process.env.PROD === "true" ? true : false,
            sameSite: "strict",
            path: "/auth"
        });

        return res.status(200).json({
            msg: "Refreshed access token!",
            userDoc: userDoc._id,
            accessToken: accessToken
        });
    }
    catch (err) {
        console.error("Unexpeted error occurred: ", err.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

export const logoutController = async (req, res) => {
    try {
        const userId = req.body.userId;
        res.clearCookie('refreshToken');

        const userDoc = await User.findById(userId);
        userDoc.refreshToken = null;
        userDoc.currentlyActive = false;
        await userDoc.save();

        return res.status(200).json({
            msg: "Logged out"
        });
    }
    catch (err) {
        console.error("Unexpeted error occurred: ", err.message);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};