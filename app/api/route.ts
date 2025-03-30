// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import Amadeus from "amadeus";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient } from "redis";

const redisClient = createClient({ url: process.env.REDIS_URL || "redis://localhost:6379" });
const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET,
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

redisClient.on("error", (err) => console.error("Redis error:", err));
(async () => {
    try {
        await redisClient.connect();
        console.log("Redis connected");
    } catch (err) {
        console.error("Redis connection failed:", err);
    }
})();

// Utility Functions
const withRedisRetry = async (fn, maxRetries = 3, delayMs = 500) => {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (err) {
            if (i === maxRetries - 1) return null;
            await new Promise((resolve) => setTimeout(resolve, delayMs * (i + 1)));
        }
    }
    return null;
};

const formatDate = (date) => date.toISOString().split("T")[0];
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

const getTotalDuration = (duration) => {
    const hours = parseInt(duration.match(/(\d+)H/)?.[1] || "0");
    const minutes = parseInt(duration.match(/(\d+)M/)?.[1] || "0");
    return hours + minutes / 60;
};

const isMorningFlight = (departureTime) => {
    const hour = new Date(departureTime).getUTCHours();
    return hour >= 5 && hour < 12;
};

const isNightFlight = (departureTime) => {
    const hour = new Date(departureTime).getUTCHours();
    return hour >= 18 || hour < 5;
};

// Recommendation functions

const calculateCostScore = (flightPrice, minPrice, maxPrice) => {
    const normalized = (maxPrice - flightPrice) / (maxPrice - minPrice || 1);
    return Math.round(normalized * 4 + 1);
};

const computeLayoverDuration = (flight) => {
    if (flight.itineraries[0].segments.length > 1) {
        let totalLayover = 0;
        for (let i = 1; i < flight.itineraries[0].segments.length; i++) {
            const prevArrival = new Date(flight.itineraries[0].segments[i - 1].arrival.at);
            const currDeparture = new Date(flight.itineraries[0].segments[i].departure.at);
            totalLayover += (currDeparture - prevArrival) / (1000 * 60 * 60);
        }
        return totalLayover;
    }
    return 0;
};

const calculateConvenienceScore = (flight, userPreferences) => {
    let score = 0;
    let factors = 0;

    // Flight Timing preference
    if (userPreferences.preferredTime) {
        const flightHour = new Date(flight.itineraries[0].segments[0].departure.at).getHours();
        if (userPreferences.preferredTime === "morning") {
            score += (flightHour >= 6 && flightHour <= 10) ? 5 : 3;
        } else if (userPreferences.preferredTime === "afternoon") {
            score += (flightHour >= 12 && flightHour < 16) ? 5 : 3;
        } else if (userPreferences.preferredTime === "evening") {
            score += (flightHour >= 17 && flightHour < 21) ? 5 : 3;
        }
        factors++;
    }

    // Direct Flight Preference
    if (userPreferences.directFlight !== undefined) {
        score += (userPreferences.directFlight && flight.itineraries[0].segments.length === 1) ? 5 : 2;
        factors++;
    }

    // Layover Duration
    const layoverDuration = computeLayoverDuration(flight);
    if (layoverDuration !== undefined) {
        if (layoverDuration < 2) score += 5;
        else if (layoverDuration < 4) score += 3;
        else score += 1;
        factors++;
    }

    return factors > 0 ? Math.round(score / factors) : 3;
};

const calculateOverallScore = (costScore, convenienceScore, weightCost = 0.5, weightConvenience = 0.5) => {
    return Math.round(costScore * weightCost + convenienceScore * weightConvenience);
};

// New: Tavily web search integration function
async function getTavilyBookingLink(flight) {
    const baseURL = "https://api.tavily.com/search"; // adjust based on Tavily docs
    const origin = flight.itineraries[0].segments[0].departure.iataCode;
    const destination = flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival.iataCode;
    const date = flight.itineraries[0].segments[0].departure.at.split("T")[0];
    // Construct a query string; you might adjust this per your needs.
    const query = `book flight ${origin} to ${destination} on ${date}`;
    const apiKey = process.env.TAVILY_API_KEY; // set your Tavily API key in your environment variables
    const url = `${baseURL}?query=${encodeURIComponent(query)}${apiKey ? `&apiKey=${apiKey}` : ""}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        // Assuming the API returns a JSON object with a "links" array
        if (data && data.links && data.links.length > 0) {
            return data.links[0]; // return the first link
        }
        return "";
    } catch (error) {
        console.error("Error fetching Tavily booking link:", error);
        return "";
    }
}

// Amadeus Functions
async function getFlightOffers(
    origin,
    destination,
    departureDate,
    adults,
    children,
    infants,
    returnDate
) {
    try {
        const response = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: origin,
            destinationLocationCode: destination,
            departureDate,
            ...(returnDate && { returnDate }),
            adults: adults.toString(),
            ...(children && { children: children.toString() }),
            ...(infants && { infants: infants.toString() }),
            currencyCode: "INR",
            max: 5,
        });
        return response.data.map((flight) => ({
            price: { total: flight.price.total, currency: flight.price.currency },
            itineraries: flight.itineraries,
            numberOfBookableSeats: flight.numberOfBookableSeats,
            lastTicketingDate: flight.lastTicketingDate,
            validatingAirlineCodes: flight.validatingAirlineCodes || [],
            pricingOptions: flight.pricingOptions || {}
        }));
    } catch (err) {
        if (err.response?.statusCode === 429) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return getFlightOffers(origin, destination, departureDate, adults, children, infants, returnDate);
        }
        console.error("Amadeus API error:", err);
        return [];
    }
}

async function fetchAndCacheFlights(
    origin,
    destination,
    date,
    adults,
    children,
    infants,
    returnDate
) {
    const cacheKey = `flight:${origin}:${destination}:${date}:${adults}:${children || 0}:${infants || 0}${returnDate ? `:${returnDate}` : ""}`;
    const cached = await withRedisRetry(() => redisClient.get(cacheKey));
    if (cached) return JSON.parse(cached);
    const flights = await getFlightOffers(origin, destination, date, adults, children, infants, returnDate);
    await withRedisRetry(() => redisClient.set(cacheKey, JSON.stringify(flights), { EX: 3600 }));
    return flights;
}

async function getLocationIATA(location) {
    if (/^[A-Z]{3}$/.test(location)) return location;
    const cacheKey = `location:iata:${location.toLowerCase()}`;
    const cachedIATA = await withRedisRetry(() => redisClient.get(cacheKey));
    if (cachedIATA) return cachedIATA;
    try {
        let response = await amadeus.referenceData.locations.get({
            keyword: location,
            subType: "AIRPORT,CITY",
        });
        if (response.data?.length > 0) {
            const iataCode = response.data[0].iataCode;
            await withRedisRetry(() => redisClient.set(cacheKey, iataCode, { EX: 86400 }));
            return iataCode;
        }
        return null;
    } catch (err) {
        console.error(`Error resolving IATA for ${location}:`, err);
        return null;
    }
}

async function getVisaRequirements(origin, destination, nationality) {
    if (!nationality) return "Nationality not provided; visa info unavailable.";
    return `Visa info for ${nationality} traveling from ${origin} to ${destination} is not directly available via Amadeus. Check with official embassy sources.`;
}

// OpenAI Functions
async function generateFlightReasoning(
    flight,
    preference,
    budget,
    tripDuration
) {
    const price = parseFloat(flight.price.total);
    const duration = getTotalDuration(flight.itineraries[0].duration);
    const isDirect = flight.itineraries[0].segments.length === 1;
    let reasoning = `This flight is recommended because it offers `;
    if (preference === "cheapest" && (!budget || price <= budget)) {
        reasoning += `a low price (₹${price.toLocaleString()}) within your budget of ₹${budget?.toLocaleString() || "N/A"}`;
    } else if (preference === "speed" && duration <= 5) {
        reasoning += `a quick travel time (${duration.toFixed(1)}h)`;
    } else if (preference === "convenience" && isDirect) {
        reasoning += `a convenient direct flight`;
    } else {
        reasoning += `a good balance of cost (₹${price.toLocaleString()}) and duration (${duration.toFixed(1)}h)`;
    }
    if (tripDuration) reasoning += `, fitting well with your ${tripDuration}-day trip`;
    reasoning += `.`;
    return reasoning;
}

async function generateFamilySoloConsideration(
    flight,
    adults,
    children,
    infants
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

async function generateMorningNightComparison(flight) {
    const departureTime = flight.itineraries[0].segments[0].departure.at;
    if (isMorningFlight(departureTime)) {
        return "Morning flight: Ideal for early arrivals and maximizing daytime at your destination.";
    } else if (isNightFlight(departureTime)) {
        return "Night flight: Great for overnight travel, saving daytime for activities or rest.";
    } else {
        return "Daytime flight: Balanced option for convenience and comfort.";
    }
}

async function generateTransitRoutes(flight) {
    const segments = flight.itineraries[0].segments;
    if (segments.length === 1) return "Direct flight: No transits required.";
    const transitPoints = segments.slice(0, -1).map(s => `${s.arrival.iataCode} (${getTotalDuration(s.duration)}h layover)`);
    return `Transit route: ${transitPoints.join(" -> ")}. Total duration: ${flight.itineraries[0].duration}.`;
}

// Process User Input
async function processUserInput(messages) {
    const systemPrompt = `
You are a flight search assistant. Based on the user's latest message:
1. If they want flights, extract:
   - baseCity (default: "DEL")
   - destinationCity (default: "BOM")
   - travelDate (default: 7 days from April 2025, YYYY-MM-DD)
   - returnDate (optional, default: null, YYYY-MM-DD)
   - adults (default: 1)
   - children (optional, default: 0)
   - infants (optional, default: 0)
   - preference (cheapest, speed, convenience, default: balanced)
   - budget (default: null, in INR)
   - tripDuration (default: null, in days)
   - nationality (optional, default: null)
   Return JSON: {
     "type": "flight",
     "baseCity": "DEL",
     "destinationCity": "BOM",
     "travelDate": "2025-04-06",
     "returnDate": null,
     "adults": 1,
     "children": 0,
     "infants": 0,
     "preference": "cheapest",
     "budget": 15000,
     "tripDuration": 5,
     "nationality": "IN"
   }
2. If they want an explanation, return JSON: {"type": "text", "query": "original user message"}
`;
    const intentResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }, ...messages.map(m => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }))],
        response_format: { type: "json_object" },
    });
    const result = JSON.parse(intentResponse.choices[0].message.content || "{}");

    if (result.type === "text") {
        const explanation = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "Provide a helpful response or explanation based on the user's query and prior context." },
                ...messages.map(m => ({ role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) })),
            ],
        });
        return explanation.choices[0].message.content || "I'm not sure how to help with that. Could you clarify?";
    }

    const { baseCity, destinationCity, travelDate, returnDate, adults, children = 0, infants = 0, preference = "balanced", budget, tripDuration, nationality } = result;
    const originIATA = await getLocationIATA(baseCity);
    const destIATA = await getLocationIATA(destinationCity);

    if (!originIATA || !destIATA) {
        const failedCity = !originIATA ? baseCity : destinationCity;
        return `Could not find the airport for ${failedCity}. Please try using the IATA code or a different city name.`;
    }

    const flights = await fetchAndCacheFlights(originIATA, destIATA, travelDate, adults, children, infants, returnDate);
    if (flights.length > 0) {
        const prices = flights.map(f => parseFloat(f.price.total));
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const userPreferences = {
            preferredTime: "morning",
            directFlight: true,
        };

        const enhancedFlights = flights
            .filter(f => !budget || parseFloat(f.price.total) <= budget)
            .sort((a, b) => {
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
            .slice(0, 3);

        for (const flight of enhancedFlights) {
            flight.reasoning = await generateFlightReasoning(flight, preference, budget, tripDuration);
            flight.familySoloConsideration = await generateFamilySoloConsideration(flight, adults, children, infants);
            flight.morningNightComparison = await generateMorningNightComparison(flight);
            flight.visaInfo = await getVisaRequirements(originIATA, destIATA, nationality);
            flight.transitRoutes = await generateTransitRoutes(flight);
            const costScore = calculateCostScore(parseFloat(flight.price.total), minPrice, maxPrice);
            const convenienceScore = calculateConvenienceScore(flight, userPreferences);
            flight.recommendationScore = calculateOverallScore(costScore, convenienceScore);
            // Fetch the booking link from Tavily via web search API
            flight.tavilyBookingLink = await getTavilyBookingLink(flight);
        }
        return enhancedFlights;
    }
    return `No flights found from ${baseCity} to ${destinationCity} on ${travelDate}${returnDate ? ` to ${returnDate}` : ""}. Try adjusting your dates or preferences.`;
}

// Main API Handler
export async function POST(request) {
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
