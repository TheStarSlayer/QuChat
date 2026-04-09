import { deleteObjects, getDownloadLink, getUploadLink } from "../lib/R2Actions.js";

export const deleteObjectsController = async (req, res) => {
    const { bucketName, keys } = req.body;

    if (await deleteObjects(bucketName, keys))
        return res.sendStatus(204);
    return res.status(500).json({ error: "Internal Server Error" });
};

export const getDownloadLinkController = async (req, res) => {
    const { bucketName, key, expiresInMin } = req.query;

    const downloadLink = await getDownloadLink(bucketName, key, expiresInMin);
    if (downloadLink !== null)
        return res.status(200).json({ downloadLink });
    return res.status(500).json({ error: "Internal Server Error" });
};

export const getUploadLinkController = async (req, res) => {
    const { bucketName, key, fileType } = req.query;

    const uploadLink = await getUploadLink(bucketName, key, fileType);
    if (uploadLink !== null)
        return res.status(200).json({ uploadLink });
    return res.status(500).json({ error: "Internal Server Error" });
};