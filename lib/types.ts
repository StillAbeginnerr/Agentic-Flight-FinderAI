export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string | object;
}

export interface FlightIntent {
    type: "flight";
    baseCity: string;
    destinationCity: string;
    travelDate: string;
    returnDate?: string | null;
    adults: number;
    children: number;
    infants: number;
    preference: "cheapest" | "speed" | "convenience" | "balanced";
    budget?: number | null;
    tripDuration?: number | null;
    nationality?: string | null;
}

export interface TextIntent {
    type: "text";
    query: string;
}

export type ParsedIntent = FlightIntent | TextIntent;

export interface FlightOffer {
    price: { total: string; currency: string };
    itineraries: any[]; 
    numberOfBookableSeats: number;
    [key: string]: any; 
}

export interface EnhancedFlightOffer extends FlightOffer {
    reasoning: string;
    familySoloConsideration: string;
    morningNightComparison: string;
    transitRoutes: string;
    visaInfo: string;
    recommendationScore: number;
    tavilyBookingLink: string;
    busynessInfo?: any; 
} 