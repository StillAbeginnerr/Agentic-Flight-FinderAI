// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import Amadeus from 'amadeus';
import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { createClient } from 'redis';

// Initialize Amadeus with environment variables
const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET,
});

// Initialize Redis client
const redisClient = createClient({
    url: process.env.REDIS_URL,
});

// Initialize OpenAI with API key from environment
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

redisClient.on('error', (error) => console.error('Redis error:', error));

// Connect to Redis on startup
(async () => {
    await redisClient.connect();
    console.log('Redis connected');
})();

export async function POST(request) {
    try {
        const { message, chatId } = await request.json();
        if (!message) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const chatKey = `chat:${chatId}`;
        const conversation = (await redisClient.get(chatKey)) || '[]';
        const messages = JSON.parse(conversation || '[]');
        messages.push({ role: 'user', content: message });

        const systemPrompt = `
You are a flight finder assistant. From the user's input, identify at least 7 of these 11 key factors:
- Base City (IATA code, e.g., NYC) || Delhi if not entered
- Destination City (IATA code, e.g., LAX) || mumbai if not entered
- Travel Dates (YYYY-MM-DD) or 2025-04-01 date if not entered
- Number of Adults || 1 if not entered
- Date Flexibility (±X days)
- Month Flexibility (±1 month)
- Budget Constraints
- Group Type and Composition (e.g., family, solo)
- Maximum Acceptable Duration || 7 days if not entered.
- Willingness for Self-Transfers (Optional, Ignore if not entered) || NO
- Transit Country Preferences/Restrictions || ignore if not entered

If fewer than 7 factors are detected, ask follow-up questions to gather the missing ones, prioritizing required factors (Base City, Destination City, Travel Dates, Number of Adults). Keep responses concise, under 50 words, and in points. Provide factors in a list format, e.g., "- Base City: NYC".
        `;

        const fullContext = [{ role: 'system', content: systemPrompt }, ...messages];
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: fullContext,
        });

        const responseContent = completion.choices[0].message.content;

        // Parse OpenAI response into factors
        const extractedFactors = {};
        responseContent.split('\n').forEach((line) => {
            const [key, value] = line.split(':').map((part) => part.trim().replace('- ', ''));
            if (key && value) extractedFactors[key] = value;
        });

        // Define required factors for Amadeus API call
        const requiredFactors = ['Base City', 'Destination City', 'Travel Dates', 'Number of Adults'];
        const hasAllRequired = requiredFactors.every((factor) => extractedFactors[factor]);

        if (hasAllRequired) {
            const payload = {
                originLocationCode: extractedFactors['Base City'],
                destinationLocationCode: extractedFactors['Destination City'],
                departureDate: extractedFactors['Travel Dates'],
                adults: extractedFactors['Number of Adults'],
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
            { error: 'An error occurred while processing your request', details: error.message },
            { status: 500 }
        );
    }
}

async function getFlightOffers(payload) {
    try {
        const { originLocationCode, destinationLocationCode, departureDate, adults } = payload;
        if (!originLocationCode || !destinationLocationCode || !departureDate || !adults) {
            throw new Error('Missing required fields in payload');
        }
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode,
            destinationLocationCode,
            departureDate,
            adults,
        });

        console.log(response)

        return response.data;
    } catch (error) {
        console.error('Amadeus GET error:', error.response?.data || error.message);
        throw error;
    }
}