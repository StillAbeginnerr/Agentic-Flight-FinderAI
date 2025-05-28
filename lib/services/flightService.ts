import { openai, geminiChatCompletion } from "../ai/aiUtils";
import {
    getLocationIATA,
    fetchAndCacheFlights,
    getBusiestTravelingPeriod,
    getVisaRequirements
} from "../api/amadeusApi";
import { getTavilyBookingLink } from "../api/tavilyApi";
import {
    calculateCostScore,
    calculateConvenienceScore,
    calculateOverallScore,
    getTotalDuration
} from "../utils/flightUtils";
import {
    generateFlightReasoning,
    generateFamilySoloConsideration,
    generateMorningNightComparison,
    generateTransitRoutes
} from "../ai/aiUtils";
import { FLIGHT_INTENT_SYSTEM_PROMPT } from "../prompts/flightSearchPrompts";
import { ChatMessage, ParsedIntent, FlightIntent, FlightOffer, EnhancedFlightOffer } from "../types";

async function parseUserIntent(messages: ChatMessage[]): Promise<ParsedIntent> {
    const systemPrompt = FLIGHT_INTENT_SYSTEM_PROMPT;
    let intentResponse: any;
    try {
        intentResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "system", content: systemPrompt }, ...messages.map((m: ChatMessage) => ({
                role: m.role,
                content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
            }))],
            response_format: { type: "json_object" },
        });
    } catch (err) {
        intentResponse = await geminiChatCompletion(messages, systemPrompt, { type: "json_object" });
    }
    return JSON.parse(intentResponse.choices[0].message.content || "{}") as ParsedIntent;
}

async function generateTextExplanation(messages: ChatMessage[]): Promise<string> {
    try {
        const explanation = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Provide a helpful response or explanation based on the user\'s query and prior context." },
                ...messages.map((m: ChatMessage) => ({ role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) })),
            ],
        });
        return explanation.choices[0].message.content || "I\'m not sure how to help with that. Could you clarify?";
    } catch (err) {
        const explanation = await geminiChatCompletion(messages, "Provide a helpful response or explanation based on the user\'s query and prior context.");
        return explanation.choices[0].message.content || "I\'m not sure how to help with that. Could you clarify?";
    }
}

interface FlightDataPayload {
    flights: FlightOffer[];
    busiestPeriodData: any; // Define more strictly based on Amadeus response
    originIATA: string;
    destIATA: string;
}

async function getFlightResolutionAndData(flightIntent: FlightIntent): Promise<FlightDataPayload | string> {
    const { baseCity, destinationCity, travelDate, returnDate, adults, children = 0, infants = 0 } = flightIntent;
    const originIATA = await getLocationIATA(baseCity);
    const destIATA = await getLocationIATA(destinationCity);

    if (!originIATA || !destIATA) {
        const failedCity = !originIATA ? baseCity : destinationCity;
        return `Could not find the airport for ${failedCity}. Please try using the IATA code or a different city name.`;
    }

    const flights: FlightOffer[] = await fetchAndCacheFlights(
        originIATA, destIATA, travelDate, adults, children, infants, returnDate ?? undefined
    );
    const busiestPeriodData = await getBusiestTravelingPeriod(originIATA, destIATA);
    return { flights, busiestPeriodData, originIATA, destIATA };
}

interface UserPreferences {
    preferredTime: string; // Example: 'morning', 'afternoon', 'evening'
    directFlight: boolean;
}

async function enhanceFlightOffers(
    flightsToEnhance: FlightOffer[],
    flightIntent: FlightIntent,
    originIATA: string,
    destIATA: string,
    busiestPeriodData: any
): Promise<EnhancedFlightOffer[]> {
    const { adults, children = 0, infants = 0, preference = "balanced", budget, tripDuration, nationality } = flightIntent;
    const prices = flightsToEnhance.map((f: FlightOffer) => parseFloat(f.price.total));
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    
    // Example user preferences; can be made dynamic based on flightIntent.preference or other factors
    const userPreferences: UserPreferences = {
        preferredTime: "morning", 
        directFlight: preference === "convenience",
    };

    return Promise.all(
        flightsToEnhance
            .filter((f: FlightOffer) => !budget || parseFloat(f.price.total) <= budget)
            .sort((a: FlightOffer, b: FlightOffer) => {
                const priceA = parseFloat(a.price.total);
                const priceB = parseFloat(b.price.total);
                const durationA = getTotalDuration(a.itineraries[0].duration);
                const durationB = getTotalDuration(b.itineraries[0].duration);
                if (preference === "cheapest") return priceA - priceB;
                if (preference === "speed") return durationA - durationB;
                if (preference === "convenience") {
                    const stopsA = a.itineraries[0].segments.length - 1;
                    const stopsB = b.itineraries[0].segments.length - 1;
                    return stopsA - stopsB || durationA - durationB;
                }
                return priceA - priceB;
            })
            .slice(0, 3)
            .map(async (flight: FlightOffer) => {
                const [
                    reasoning,
                    familySoloConsideration,
                    morningNightComparison,
                    transitRoutes,
                    visaInfo,
                    tavilyBookingLink
                ] = await Promise.all([
                    generateFlightReasoning(flight, preference, budget ?? undefined, tripDuration ?? undefined),
                    generateFamilySoloConsideration(flight, adults, children, infants),
                    generateMorningNightComparison(flight),
                    generateTransitRoutes(flight),
                    getVisaRequirements(originIATA, destIATA, nationality ?? undefined),
                    getTavilyBookingLink(flight)
                ]);

                const costScore = calculateCostScore(parseFloat(flight.price.total), minPrice, maxPrice);
                const convenienceScore = calculateConvenienceScore(flight, userPreferences);
                const recommendationScore = calculateOverallScore(costScore, convenienceScore);

                return {
                    ...flight,
                    reasoning,
                    familySoloConsideration,
                    morningNightComparison,
                    transitRoutes,
                    visaInfo,
                    recommendationScore,
                    tavilyBookingLink,
                    busynessInfo: busiestPeriodData?.[0] || null
                } as EnhancedFlightOffer;
            })
    );
}

export async function processUserInput(messages: ChatMessage[]): Promise<string | object> {
    const parsedIntent = await parseUserIntent(messages);

    if (parsedIntent.type === "text") {
        return generateTextExplanation(messages);
    }

    const flightIntent = parsedIntent as FlightIntent;
    const flightDataResult = await getFlightResolutionAndData(flightIntent);

    if (typeof flightDataResult === "string") {
        return flightDataResult; 
    }

    const { flights, busiestPeriodData, originIATA, destIATA } = flightDataResult;

    if (flights.length === 0) {
        return `No flights found from ${flightIntent.baseCity} to ${flightIntent.destinationCity} on ${flightIntent.travelDate}${flightIntent.returnDate ? ` to ${flightIntent.returnDate}` : ""}. Try adjusting your dates or preferences.`;
    }

    const enhancedFlights = await enhanceFlightOffers(flights, flightIntent, originIATA, destIATA, busiestPeriodData);

    return {
        flights: enhancedFlights,
        busiestTravelingPeriod: busiestPeriodData, 
    };
} 