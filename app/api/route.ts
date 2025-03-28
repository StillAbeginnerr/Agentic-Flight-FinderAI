// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck


import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from 'redis'

const redisClient = createClient({
    url: process.env.REDIS_URL,
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Standard OpenAI API key
});

redisClient.on("error", (error) => console.error("Redis error:", error));

(async () =>{
    await redisClient.connect();
    console.log('Redis connected');
})();

export async function POST(request) {
    try {
        const { message, chatId } = await request.json();

        if (!message) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const chatKey = `chat:${chatId}`;

        const conversation = await redisClient.get(chatKey) || "[]";
        console.log("Raw conversation from Redis:", conversation); // Debug log

        // Handle null or invalid JSON safely
        let messages = [];
        if (conversation) {
            try {
                messages = JSON.parse(conversation);
            } catch (parseError) {
                console.error("Failed to parse conversation:", parseError);
                messages = []; // Reset to empty array if parsing fails
            }
        }
        messages.push({ role: "user", content: message });


        const systemPrompt = `
      You are a flight finder assistant. From the user's input, identify at least 7 of these 10 key factors:
      - Base City
      - Travel Dates
      - Date Flexibility (±X days)
      - Month Flexibility (±1 month)
      - Budget Constraints
      - Group Type and Composition
      - Maximum Acceptable Duration
      - Willingness for Self-Transfers
      - Transit Country Preferences/Restrictions
      - Destination City (with potential alternatives)
      
      If fewer than 7 factors are detected, ask follow-up questions to gather the missing ones, prioritizing required factors (Base City, Travel Dates, Date Flexibility, Month Flexibility, Budget Constraints, Maximum Acceptable Duration, Destination City). Keep responses concise, under 50 words, and in points.
    `;

        let fullContext = [
            {
                role: "system",
                content: systemPrompt,
            },
            ...messages,
        ]

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: fullContext
        });

        const responseContent = completion.choices[0].message.content;

        let extractionPrompt = [
            {
                role: "system",
                content: fullContext,
            },
            {
                role: "Understanding Agent",
                content: `
     From the fullContext, separate these in a list format:
      - Base City
      - Travel Dates
      - Date Flexibility (±X days)
      - Month Flexibility (±1 month)
      - Budget Constraints
      - Group Type and Composition
      - Maximum Acceptable Duration
      - Willingness for Self-Transfers
      - Transit Country Preferences/Restrictions
      - Destination City (with potential alternatives)
    \``,
            },
            ]

        const extractedFactors = {};
        responseContent.split("\n").forEach((line) => {
            const [key, value] = line.split(":").map((part) => part.trim().replace("- ", ""));
            if (key && value) extractedFactors[key] = value;
        });

        // Update inputContext with extracted factors
        const inputContext = [
            {
                role: "system",
                content: JSON.stringify(extractedFactors),
            },
            {
                role: "assistant",
                content: extractionPrompt, 
            },
        ];

        console.log("Extracted factors:", inputContext); // Debug log

        messages.push({role: "assistant", content: responseContent});

        await redisClient.set(chatKey, JSON.stringify(messages));

        return NextResponse.json({ response: responseContent });
    } catch (error) {
        console.error("OpenAI API error:", error);
        return NextResponse.json(
            { error: "An error occurred while processing your request", details: error.message },
            { status: 500 }
        );
    }
}

export const config = {
    api: {
        bodyParser: true,
    },
};