import { useState } from 'react';
import { fetchAndCacheFlights, getLocationIATA, getBusiestTravelingPeriod } from '../lib/api/amadeusApi';
import { calculateCostScore, calculateConvenienceScore, calculateOverallScore } from '../lib/utils/flightUtils';
import { generateFlightReasoning, generateFamilySoloConsideration, generateMorningNightComparison, generateTransitRoutes } from '../lib/ai/aiUtils';

interface FlightSearchParams {
    baseCity: string;
    destinationCity: string;
    travelDate: string;
    returnDate?: string;
    adults: number;
    children?: number;
    infants?: number;
    preference?: 'cheapest' | 'speed' | 'convenience' | 'balanced';
    budget?: number;
    tripDuration?: number;
    nationality?: string;
}

interface UseFlightSearchReturn {
    searchFlights: (params: FlightSearchParams) => Promise<void>;
    flights: any[];
    loading: boolean;
    error: string | null;
    busiestTravelingPeriod: any;
}

export function useFlightSearch(): UseFlightSearchReturn {
    const [flights, setFlights] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [busiestTravelingPeriod, setBusiestTravelingPeriod] = useState<any>(null);

    const searchFlights = async (params: FlightSearchParams) => {
        setLoading(true);
        setError(null);
        try {
            const {
                baseCity,
                destinationCity,
                travelDate,
                returnDate,
                adults,
                children,
                infants,
                preference = 'balanced',
                budget,
                tripDuration,
                nationality
            } = params;

            const originIATA = await getLocationIATA(baseCity);
            const destIATA = await getLocationIATA(destinationCity);

            if (!originIATA || !destIATA) {
                const failedCity = !originIATA ? baseCity : destinationCity;
                throw new Error(`Could not find the airport for ${failedCity}. Please try using the IATA code or a different city name.`);
            }

            const [flightsData, busiestPeriodData] = await Promise.all([
                fetchAndCacheFlights(originIATA, destIATA, travelDate, adults, children, infants, returnDate),
                getBusiestTravelingPeriod(originIATA, destIATA)
            ]);

            if (flightsData.length === 0) {
                throw new Error(`No flights found from ${baseCity} to ${destinationCity} on ${travelDate}${returnDate ? ` to ${returnDate}` : ""}. Try adjusting your dates or preferences.`);
            }

            const prices = flightsData.map((f: any) => parseFloat(f.price.total));
            const minPrice = Math.min(...prices);
            const maxPrice = Math.max(...prices);
            const userPreferences = {
                preferredTime: "morning",
                directFlight: true,
            };

            const enhancedFlights = await Promise.all(
                flightsData
                    .filter((f: any) => !budget || parseFloat(f.price.total) <= budget)
                    .sort((a: any, b: any) => {
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
                    .map(async (flight: any) => {
                        const [
                            reasoning,
                            familySoloConsideration,
                            morningNightComparison,
                            transitRoutes
                        ] = await Promise.all([
                            generateFlightReasoning(flight, preference, budget, tripDuration),
                            generateFamilySoloConsideration(flight, adults, children, infants),
                            generateMorningNightComparison(flight),
                            generateTransitRoutes(flight)
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
                            recommendationScore,
                            busynessInfo: busiestPeriodData?.[0] || null
                        };
                    })
            );

            setFlights(enhancedFlights);
            setBusiestTravelingPeriod(busiestPeriodData);
        } catch (err: any) {
            setError(err.message || 'An error occurred while searching for flights');
            setFlights([]);
        } finally {
            setLoading(false);
        }
    };

    return {
        searchFlights,
        flights,
        loading,
        error,
        busiestTravelingPeriod
    };
}

import { getTotalDuration } from '../lib/utils/flightUtils'; 