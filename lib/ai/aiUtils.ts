import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function geminiChatCompletion(messages: any[], systemPrompt: string, responseFormat?: any) {
    const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = [
        { role: "system", parts: [{ text: systemPrompt }] },
        ...messages.map((m: any) => ({ 
            role: m.role, 
            parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }] 
        }))
    ];
    const result = await gemini.models.generateContent({
        model: "gemini-2.0-flash",
        contents: prompt,
    });
    return { choices: [{ message: { content: result.text } }] };
}

export async function generateFlightReasoning(
    flight: any,
    preference: string,
    budget?: number,
    tripDuration?: number
) {
    const price = parseFloat(flight.price.total);
    const duration = getTotalDuration(flight.itineraries[0].duration);
    const isDirect = flight.itineraries[0].segments.length === 1;
    let reasoning = "This flight is recommended because it offers ";
    if (preference === "cheapest" && (!budget || price <= budget)) {
        reasoning += `a low price (₹${price.toLocaleString()}) within your budget of ₹${budget?.toLocaleString() || "N/A"}`;
    } else if (preference === "speed" && duration <= 5) {
        reasoning += `a quick travel time (${duration.toFixed(1)}h)`;
    } else if (preference === "convenience" && isDirect) {
        reasoning += "a convenient direct flight";
    } else {
        reasoning += `a good balance of cost (₹${price.toLocaleString()}) and duration (${duration.toFixed(1)}h)`;
    }
    if (tripDuration) reasoning += `, fitting well with your ${tripDuration}-day trip`;
    reasoning += ".";
    return reasoning;
}

export async function generateFamilySoloConsideration(
    flight: any,
    adults: number,
    children?: number,
    infants?: number
) {
    const seats = flight.numberOfBookableSeats;
    const totalTravelers = adults + (children || 0) + (infants || 0);
    if (adults === 1 && !children && !infants) {
        return "Ideal for solo travelers due to flexibility and availability.";
    } else if (children || infants) {
        return seats >= totalTravelers
            ? `Suitable for families with ${children || 0} children and ${infants || 0} infants; ${seats} seats available.`
            : `Limited seats (${seats}); may not accommodate all ${totalTravelers} travelers.`;
    } else {
        return `Good for a group of ${adults} adults with ${seats} seats available.`;
    }
}

export async function generateMorningNightComparison(flight: any) {
    const departureTime = flight.itineraries[0].segments[0].departure.at;
    if (isMorningFlight(departureTime)) {
        return "Morning flight: Ideal for early arrivals and maximizing daytime at your destination.";
    } else if (isNightFlight(departureTime)) {
        return "Night flight: Great for overnight travel, saving daytime for activities or rest.";
    } else {
        return "Daytime flight: Balanced option for convenience and comfort.";
    }
}

export async function generateTransitRoutes(flight: any) {
    const segments = flight.itineraries[0].segments;
    if (segments.length === 1) return "Direct flight: No transits required.";
    const transitPoints = segments.slice(0, -1).map((s: any) => `${s.arrival.iataCode} (${getTotalDuration(s.duration)}h layover)`);
    return `Transit route: ${transitPoints.join(" -> ")}. Total duration: ${flight.itineraries[0].duration}.`;
}

import { getTotalDuration, isMorningFlight, isNightFlight } from "../utils/flightUtils"; 