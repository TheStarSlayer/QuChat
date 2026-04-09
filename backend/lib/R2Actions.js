import { r2Client } from "../index.js";

import {
    DeleteObjectsCommand, PutObjectCommand, GetObjectCommand,
    S3ServiceException, waitUntilObjectNotExists
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const deleteObjects = async (bucketName, keys) => {
    try {
        await r2Client.send(
            new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: keys.map((k) => ({ Key: k })),
                },
            }),
        );

        console.log("Deleted files successfully!");
        return true;
    }
    catch (error) {
        if (error instanceof S3ServiceException && error.name === "NoSuchBucket") {
            console.error(
                `Error from S3 while deleting objects from ${bucketName}. The bucket doesn't exist.`,
            );
        }
        else if (error instanceof S3ServiceException) {
            console.error(
                `Error from S3 while deleting objects from ${bucketName}.  ${error.name}: ${error.message}`,
            );
        }
        console.error(error);
        return false;
    }
};

export const getUploadLink = async (bucketName, key, fileType) => {
    try {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            ContentType: fileType
        });

        return await getSignedUrl(r2Client, command, { expiresIn: 80 });
    }
    catch (error) {
        console.error(error);
        return null;
    }
};

export const getDownloadLink = async (bucketName, key, expiresInMin) => { 
    try {    
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        return await getSignedUrl(r2Client, command, { expiresIn: expiresInMin * 60 });
    }
    catch (error) {
        console.error(error);
        return null;
    }
};