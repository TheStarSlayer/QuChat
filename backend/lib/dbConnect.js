import mongoose from "mongoose";
import redis from 'redis';

export const mongoConnect = () => {
    try {
        mongoose.connect(process.env.MONGODB_CONN);
    }
    catch (err) {
        console.error("Unexpected error occurred: Database could not be connected.");
        console.error(err);
    }
};

export const redisConnect = async () => {
    try {
        const client = redis.createClient({
            username: 'thestarslayer',
            password: process.env.REDIS_PASSWORD,
            socket: {
                host: 'redis-19217.c80.us-east-1-2.ec2.cloud.redislabs.com',
                port: 19217
            }
        });
        client.on('error', (err) => {
            console.error("Unexpected error occurred: Cache could not be connected.");
            console.error(err);
        });
        await client.connect();
        await client.flushAll();

        return client;
    }
    catch (err) {
        console.error("Unexpected error occurred: Cache could not be connected.");
        console.error(err);
    }
};