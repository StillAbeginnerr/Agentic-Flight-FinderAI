import { NextResponse } from "next/server";
// Imports from lib
import { redisClient, withRedisRetry } from "../../lib/utils/redisUtils";
import { processUserInput } from "../../lib/services/flightService";

// Main API Handler
export async function POST(request: Request) {
    try {
        const { message, chatId, clientId } = await request.json();
        if (!message || !chatId || !clientId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }
        const chatKey = `chat:${chatId}`;
        const rawMessages = (await withRedisRetry(() => redisClient.get(chatKey))) || "[]";
        const messages = JSON.parse(rawMessages);
        messages.push({ role: "user", content: message });
        const responseData = await processUserInput(messages);
        messages.push({ role: "assistant", content: responseData });
        await withRedisRetry(() => redisClient.set(chatKey, JSON.stringify(messages), { EX: 86400 }));
        return NextResponse.json({ response: responseData });
    } catch (err) {
        console.error("API error:", err);
        return NextResponse.json({ error: "Internal server error", details: String(err) }, { status: 500 });
    }
}
