export interface Segment {
    departure: {
        iataCode: string;
        at: string;
    };
    arrival: {
        iataCode: string;
        at: string;
    };
    carrierCode?: string;
}

export interface Itinerary {
    duration?: string;
    segments: Segment[];
}

export interface PricingOptions {
    includedCheckedBagsOnly?: boolean;
    fareType?: string[];
}

export interface CostBreakdown {
    baseFare: number;
    taxes: number;
    fees: number;
    discount?: number;
}

export interface FlightOffer {
    price: {
        currency: string;
        total: string;
    };
    validatingAirlineCodes?: string[];
    itineraries: Itinerary[];
    lastTicketingDate: string;
    numberOfBookableSeats: number;
    pricingOptions?: PricingOptions;
    reasoning?: string;
    transitRoutes?: string;
    familySoloConsideration?: string;
    morningNightComparison?: string;
    visaInfo?: string;
    costBreakdown?: CostBreakdown;
    scores?: {
        cost: number;
        convenience: number;
        overall: number;
    };
    // New optional busyness info attached from the backend.
    busynessInfo?: any;
}

export interface Message {
    role: "user" | "assistant";
    // The assistant response can be a string or an object containing flights and period info.
    content: string | { flights: FlightOffer[]; busiestTravelingPeriod: any };
}

export type PreferredTime = "morning" | "afternoon" | "evening";
export type TravelClass = "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";

export interface UserPreferences {
    preferredTime?: PreferredTime;
    directFlight?: boolean;
    maxPrice?: number;
    preferredAirline?: string;
    travelClass?: TravelClass;
} 