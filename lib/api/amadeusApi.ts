// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
import Amadeus from "amadeus";
import { redisClient, withRedisRetry } from "../utils/redisUtils";

export const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET,
});

export async function getFlightOffers(
    origin: string,
    destination: string,
    departureDate: string,
    adults: number,
    children?: number,
    infants?: number,
    returnDate?: string
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
        return response.data.map((flight: any) => ({
            price: { total: flight.price.total, currency: flight.price.currency },
            itineraries: flight.itineraries,
            numberOfBookableSeats: flight.numberOfBookableSeats,
            lastTicketingDate: flight.lastTicketingDate,
            validatingAirlineCodes: flight.validatingAirlineCodes || [],
            pricingOptions: flight.pricingOptions || {}
        }));
    } catch (err: any) {
        if (err.response?.statusCode === 429) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            return getFlightOffers(origin, destination, departureDate, adults, children, infants, returnDate);
        }
        console.error("Amadeus API error:", err);
        return [];
    }
}

export async function fetchAndCacheFlights(
    origin: string,
    destination: string,
    date: string,
    adults: number,
    children?: number,
    infants?: number,
    returnDate?: string
) {
    const cacheKey = `flight:${origin}:${destination}:${date}:${adults}:${children || 0}:${infants || 0}${returnDate ? `:${returnDate}` : ""}`;
    const cached = await withRedisRetry(() => redisClient.get(cacheKey));
    if (cached) return JSON.parse(cached);
    const flights = await getFlightOffers(origin, destination, date, adults, children, infants, returnDate);
    await withRedisRetry(() => redisClient.set(cacheKey, JSON.stringify(flights), { EX: 3600 }));
    return flights;
}

export async function getLocationIATA(location: string) {
    if (/^[A-Z]{3}$/.test(location)) return location;
    const cacheKey = `location:iata:${location.toLowerCase()}`;
    const cachedIATA = await withRedisRetry(() => redisClient.get(cacheKey));
    if (cachedIATA) return cachedIATA;
    try {
        const response = await amadeus.referenceData.locations.get({
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

export async function getBusiestTravelingPeriod(originCityCode: string, destinationCityCode: string) {
    try {
        const response = await amadeus.analytics.flight.busiestTravelingPeriod.get({
            originCityCode,
            destinationCityCode,
        });
        return response.data;
    } catch (error) {
        console.error("Error fetching busiest traveling period:", error);
        return null;
    }
}

export async function getVisaRequirements(origin: string, destination: string, nationality?: string) {
    if (!nationality) return "Nationality not provided; visa info unavailable.";
    return `Visa info for ${nationality} traveling from ${origin} to ${destination} is not directly available via Amadeus. Check with official embassy sources.`;
} 