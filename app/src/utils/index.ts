import { FlightOffer, UserPreferences, CostBreakdown, PreferredTime, TravelClass } from "../types";
import { AIRLINES, EUR_TO_INR } from "../constants";

// Function to convert EUR to INR
export const convertToRupees = (euroAmount: string) => {
    const amount = parseFloat(euroAmount);
    const rupeesAmount = (amount * EUR_TO_INR).toFixed(2);
    return rupeesAmount;
};

// Format date and time for better readability
export const formatDateTime = (dateTimeString: string) => {
    if (!dateTimeString) return "N/A";
    return new Date(dateTimeString).toLocaleString("en-IN");
};

// Function to compute layover duration in hours (if any)
export const computeLayoverDuration = (flight: FlightOffer) => {
    if (flight.itineraries[0].segments.length > 1) {
        let totalLayover = 0;
        for (let i = 1; i < flight.itineraries[0].segments.length; i++) {
            const prevArrival = new Date(flight.itineraries[0].segments[i - 1].arrival.at);
            const currDeparture = new Date(flight.itineraries[0].segments[i].departure.at);
            totalLayover += (currDeparture.getTime() - prevArrival.getTime()) / (1000 * 60 * 60); // in hours
        }
        return totalLayover;
    }
    return 0;
};

// Calculate cost score (1 to 5)
export const calculateCostScore = (flightPrice: number, minPrice: number, maxPrice: number) => {
    // Normalize the price so that the cheapest gets a 5 and the most expensive a 1.
    const normalized = (maxPrice - flightPrice) / (maxPrice - minPrice || 1);
    return Math.round(normalized * 4 + 1); // scale between 1 and 5
};

// Calculate convenience score based on timing, direct flights, and layover duration.
export const calculateConvenienceScore = (flight: FlightOffer, userPreferences: UserPreferences) => {
    let score = 0;
    let factors = 0;

    // Example factor: Flight Timing
    if (userPreferences.preferredTime) {
        const flightHour = new Date(flight.itineraries[0].segments[0].departure.at).getHours();
        if (userPreferences.preferredTime === "morning") {
            score += flightHour >= 6 && flightHour <= 10 ? 5 : 3;
        } else if (userPreferences.preferredTime === "afternoon") {
            score += flightHour >= 12 && flightHour < 16 ? 5 : 3;
        } else if (userPreferences.preferredTime === "evening") {
            score += flightHour >= 17 && flightHour < 21 ? 5 : 3;
        }
        factors++;
    }

    // Example factor: Direct Flight preference
    if (userPreferences.directFlight !== undefined) {
        score += userPreferences.directFlight && flight.itineraries[0].segments.length === 1 ? 5 : 2;
        factors++;
    }

    // Example factor: Layover duration (shorter is better)
    const layoverDuration = computeLayoverDuration(flight);
    if (layoverDuration !== undefined) {
        if (layoverDuration < 2) score += 5;
        else if (layoverDuration < 4) score += 3;
        else score += 1;
        factors++;
    }

    // Return average score of convenience factors
    return factors > 0 ? Math.round(score / factors) : 3;
};

// Calculate overall recommendation score as a weighted average
export const calculateOverallScore = (
    costScore: number,
    convenienceScore: number,
    weightCost = 0.5,
    weightConvenience = 0.5
) => {
    return Math.round(costScore * weightCost + convenienceScore * weightConvenience);
};

// Generate cost breakdown for a flight offer
export const generateCostBreakdown = (totalPrice: number): CostBreakdown => {
    // This is a simplified example - in a real app, these would come from the API
    const baseFare = totalPrice * 0.7; // 70% of total is base fare
    const taxes = totalPrice * 0.2; // 20% is taxes
    const fees = totalPrice * 0.1; // 10% is fees

    return {
        baseFare: parseFloat(baseFare.toFixed(2)),
        taxes: parseFloat(taxes.toFixed(2)),
        fees: parseFloat(fees.toFixed(2)),
    };
};

// Function to create flight offers with cost breakdown and scores
export const createFlightOffers = (rawOffers: any[], userPreferences: UserPreferences): FlightOffer[] => {
    // First, extract price information to calculate min and max for scoring
    const priceValues = rawOffers.map((offer) => parseFloat(offer.price.total));
    const minPrice = Math.min(...priceValues);
    const maxPrice = Math.max(...priceValues);

    // Process each offer to add cost breakdown and scores
    return rawOffers.map((offer) => {
        const priceInNumber = parseFloat(offer.price.total);

        // Calculate scores
        const costScore = calculateCostScore(priceInNumber, minPrice, maxPrice);
        const convenienceScore = calculateConvenienceScore(offer, userPreferences);
        const overallScore = calculateOverallScore(costScore, convenienceScore);

        // Generate cost breakdown
        const costBreakdown = generateCostBreakdown(priceInNumber);

        // Return enhanced offer
        return {
            ...offer,
            costBreakdown,
            scores: {
                cost: costScore,
                convenience: convenienceScore,
                overall: overallScore,
            },
        };
    });
};

// Parse the preferred time from the user input (if any)
export const parsePreferredTime = (query: string): PreferredTime | undefined => {
    const timeKeywords = [
        { term: "morning", regex: /\b(morning|early|dawn|am)\b/i },
        { term: "afternoon", regex: /\b(afternoon|noon|midday)\b/i },
        { term: "evening", regex: /\b(evening|night|late|pm)\b/i },
    ];

    for (let time of timeKeywords) {
        if (time.regex.test(query)) {
            return time.term as PreferredTime;
        }
    }
    return undefined;
};

// Parse direct flight preference from user input (if any)
export const parseDirectFlight = (query: string): boolean | undefined => {
    if (/\b(direct|non-stop|nonstop|no stop|no connection)\b/i.test(query)) {
        return true;
    }
    if (/\b(layover|connection|connecting|indirect)\b/i.test(query)) {
        return false;
    }
    return undefined;
};

// Parse max price from user input (if any)
export const parseMaxPrice = (query: string): number | undefined => {
    const priceMatch = query.match(
        /\b(under|below|max|maximum|less than|up to)\s*[$₹€]?\s*(\d+(?:,\d+)*(?:\.\d+)?)\b/i
    );
    if (priceMatch && priceMatch[2]) {
        return parseFloat(priceMatch[2].replace(/,/g, ""));
    }
    return undefined;
};

// Parse preferred airline from user input (if any)
export const parsePreferredAirline = (query: string): string | undefined => {
    for (const airline of AIRLINES) {
        if (query.toLowerCase().includes(airline.toLowerCase())) {
            return airline;
        }
    }
    return undefined;
};

// Parse travel class from user input (if any)
export const parseTravelClass = (
    query: string
): TravelClass | undefined => {
    if (/\b(economy|coach)\b/i.test(query)) return "ECONOMY";
    if (/\b(premium economy|premium)\b/i.test(query)) return "PREMIUM_ECONOMY";
    if (/\b(business|business class)\b/i.test(query)) return "BUSINESS";
    if (/\b(first|first class)\b/i.test(query)) return "FIRST";
    return undefined;
}; 