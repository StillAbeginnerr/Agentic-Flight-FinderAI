// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import Amadeus from 'amadeus';
import OpenAI from 'openai';
import { NextResponse, NextRequest } from 'next/server';
import { createClient } from 'redis';

// Initialize Redis client
const redisClient = createClient({
    url: process.env.REDIS_URL,
});

// Initialize Amadeus with validation
const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID || (() => { throw new Error('AMADEUS_CLIENT_ID not set'); })(),
    clientSecret: process.env.AMADEUS_CLIENT_SECRET || (() => { throw new Error('AMADEUS_CLIENT_SECRET not set'); })(),
});



// Initialize OpenAI with validation
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || (() => { throw new Error('OPENAI_API_KEY not set'); })(),
});

redisClient.on('error', (error) => console.error('Redis error:', error));

// Connect to Redis on startup
(async () => {
    try {
        await redisClient.connect();
        console.log('Redis connected');
    } catch (error) {
        console.error('Redis connection failed:', error);
    }
})();

export async function POST(request: NextRequest) {
    try {
        const { message, chatId, clientId } = await request.json();

        // Validate basic inputs
        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }
        if (!chatId) {
            return NextResponse.json({ error: 'Chat ID is required' }, { status: 400 });
        }
        // Optionally validate clientId if your app needs it
        if (!clientId) {
            return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
        }

        const chatKey = `chat:${chatId}`;
        const conversation = await redisClient.get(chatKey) || '[]';
        const messages = JSON.parse(conversation || '[]');
        messages.push({ role: 'user', content: message });

        const systemPrompt = `
You are a flight finder assistant. From the user's input, identify at least 7 of these 11 key factors:
- Base City (IATA code, e.g., NYC) || Delhi if not entered
- Destination City (IATA code, e.g., LAX) || Mumbai if not entered
- Travel Dates (YYYY-MM-DD) || 2025-04-01 if not entered
- Number of Adults || 1 if not entered
- Date Flexibility (±X days)
- Month Flexibility (±1 month)
- Budget Constraints
- Group Type and Composition (e.g., family, solo)
- Maximum Acceptable Duration || 7 days if not entered
- Willingness for Self-Transfers (Optional, Ignore if not entered) || NO
- Transit Country Preferences/Restrictions || ignore if not entered

If fewer than 7 factors are detected, ask follow-up questions to gather the missing ones, prioritizing required factors (Base City, Destination City, Travel Dates, Number of Adults). Keep responses concise, under 50 words, and in points. Provide factors in a list format, e.g., "- Base City: NYC".
        `;

        const fullContext = [{ role: 'system', content: systemPrompt }, ...messages];
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: fullContext,
        });

        const responseContent = completion.choices[0].message.content || " ";

        // Parse OpenAI response into factors
        const extractedFactors: { [key: string]: string } = {};
        responseContent.split('\n').forEach((line) => {
            const [key, value] = line.split(':').map((part) => part.trim().replace('- ', ''));
            if (key && value) extractedFactors[key] = value;
        });

        const requiredFactors = ['Base City', 'Destination City', 'Travel Dates', 'Number of Adults'];
        const hasAllRequired = requiredFactors.every((factor) => extractedFactors[factor]);

        if (hasAllRequired) {
            const payload = {
                originLocationCode: extractedFactors['Base City'],
                destinationLocationCode: extractedFactors['Destination City'],
                departureDate: extractedFactors['Travel Dates'],
                adults: parseInt(extractedFactors['Number of Adults']) || 1,
            };
            const flightData = await getFlightOffers(payload);
            messages.push({ role: 'assistant', content: JSON.stringify(flightData) });
            await redisClient.set(chatKey, JSON.stringify(messages));
            return NextResponse.json({ response: flightData });
        } else {
            messages.push({ role: 'assistant', content: responseContent });
            await redisClient.set(chatKey, JSON.stringify(messages));
            return NextResponse.json({ response: responseContent });
        }
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: 'An error occurred while processing your request', details: (error as Error).message },
            { status: 500 }
        );
    } finally {
        // Ensure Redis connection is maintained
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }
    }
}

async function getFlightOffers(payload: {
    originLocationCode: string;
    destinationLocationCode: string;
    departureDate: string;
    adults: number;
}) {
    try {
        const { originLocationCode, destinationLocationCode, departureDate, adults } = payload;
        if (!originLocationCode || !destinationLocationCode || !departureDate || !adults) {
            throw new Error('Missing required fields in payload');
        }
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode,
            destinationLocationCode,
            departureDate,
            adults: adults.toString(), // Amadeus expects string
        });

        console.log('Flight offers response:', response.data);
        return response.data;
    } catch (error) {
        // console.error('Amadeus GET error:', error.response?.data || error.message);
        console.log(error)
        throw error;
    }
}

// Ensure proper cleanup on server shutdown
process.on('SIGTERM', async () => {
    await redisClient.quit();
    process.exit(0);
});