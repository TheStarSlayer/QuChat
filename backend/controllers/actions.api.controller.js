export const verifyAccessTokenController = (_, res) => {
    return res.status(200).json({ msg: "Access token verified successfully!" });
};