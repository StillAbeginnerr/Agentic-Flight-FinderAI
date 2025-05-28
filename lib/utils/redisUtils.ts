import { createClient } from "redis";

export const redisClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });

redisClient.on("error", (err) => console.error("Redis error:", err));

(async () => {
    try {
        await redisClient.connect();
        console.log("Redis connected");
    } catch (err) {
        console.error("Redis connection failed:", err);
    }
})();

export const withRedisRetry = async <T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delayMs: number = 500
): Promise<T | null> => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err: any) {
            console.log(err);
            if (i === maxRetries - 1) return null;
            await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
        }
    }
    return null;
}; 