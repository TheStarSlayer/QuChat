import jwt from "jsonwebtoken";

export const apiVerify = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const [bearer, token] = authHeader.split(' ');

    if (bearer !== "Bearer" || !token)
        return res.status(401).json({ error: 'Invalid auth token' });

    try {
        const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
            algorithms: ["HS256"]
        });
        req.userId = payload.userId;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: 'Invalid auth token' });
    }
};