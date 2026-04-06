import { redisConnect } from "./lib/dbConnect.js";
import "dotenv/config";

async function flushCache() {
    const client = await redisConnect();
    await client.flushAll();
    console.log("Flushed all cache!");
}

flushCache();