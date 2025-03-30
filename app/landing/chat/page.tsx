"use client";

import React, { useState, useEffect, useRef } from "react";
import { SendHorizontal, Bot, User, Calendar, Clock, Luggage, DollarSign, BarChart2, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define TypeScript interfaces
interface Segment {
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

interface Itinerary {
    duration?: string;
    segments: Segment[];
}

interface PricingOptions {
    includedCheckedBagsOnly?: boolean;
    fareType?: string[];
}

interface CostBreakdown {
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

interface Message {
    role: "user" | "assistant";
    // The assistant response can be a string or an object containing flights and period info.
    content: string | { flights: FlightOffer[]; busiestTravelingPeriod: any };
}

interface UserPreferences {
    preferredTime?: "morning" | "afternoon" | "evening";
    directFlight?: boolean;
    maxPrice?: number;
    preferredAirline?: string;
    travelClass?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
}

// Exchange rate - EUR to INR (as of March 2025, this is an approximation)
const EUR_TO_INR = 92.5;

const FlightFinderChat = () => {
    const [chatId] = useState(Date.now());
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content:
                "I'm here to help with your flight plans. Tell me your departure city, destination, dates, and any other preferences you have!",
        },
    ]);
    const [inputMessage, setInputMessage] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Function to convert EUR to INR
    const convertToRupees = (euroAmount: string) => {
        const amount = parseFloat(euroAmount);
        const rupeesAmount = (amount * EUR_TO_INR).toFixed(2);
        return rupeesAmount;
    };

    // Format date and time for better readability
    const formatDateTime = (dateTimeString: string) => {
        if (!dateTimeString) return "N/A";
        return new Date(dateTimeString).toLocaleString("en-IN");
    };

    // Function to compute layover duration in hours (if any)
    const computeLayoverDuration = (flight: FlightOffer) => {
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
    const calculateCostScore = (flightPrice: number, minPrice: number, maxPrice: number) => {
        // Normalize the price so that the cheapest gets a 5 and the most expensive a 1.
        const normalized = (maxPrice - flightPrice) / (maxPrice - minPrice || 1);
        return Math.round(normalized * 4 + 1); // scale between 1 and 5
    };

    // Calculate convenience score based on timing, direct flights, and layover duration.
    const calculateConvenienceScore = (flight: FlightOffer, userPreferences: UserPreferences) => {
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
    const calculateOverallScore = (
        costScore: number,
        convenienceScore: number,
        weightCost = 0.5,
        weightConvenience = 0.5
    ) => {
        return Math.round(costScore * weightCost + convenienceScore * weightConvenience);
    };

    // Generate cost breakdown for a flight offer
    const generateCostBreakdown = (totalPrice: number): CostBreakdown => {
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

    // FlightOffer component with recommendation score, cost breakdown, and booking link
    const FlightOfferComponent = ({
                                      offer,
                                      userPreferences,
                                      minPrice,
                                      maxPrice,
                                  }: {
        offer: FlightOffer;
        userPreferences: UserPreferences;
        minPrice: number;
        maxPrice: number;
    }) => {
        const [showCostBreakdown, setShowCostBreakdown] = useState(true);

        // Convert price to rupees if currency is EUR
        const priceInNumber = parseFloat(offer.price.total);
        const priceDisplay =
            offer.price.currency === "EUR"
                ? `₹${convertToRupees(offer.price.total)} (€${offer.price.total})`
                : `₹${offer.price.total}`;

        // Calculate scores if not already provided
        const costScore = offer.scores?.cost || calculateCostScore(priceInNumber, minPrice, maxPrice);
        const convenienceScore =
            offer.scores?.convenience || calculateConvenienceScore(offer, userPreferences);
        const overallScore = offer.scores?.overall || calculateOverallScore(costScore, convenienceScore);

        // Generate cost breakdown if not already provided
        const costBreakdown = offer.costBreakdown || generateCostBreakdown(priceInNumber);

        return (
            <div className="bg-black border border-white/20 p-4 rounded-md mb-3 text-white">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-medium">{priceDisplay}</span>
                    <span className="text-sm bg-white/10 px-2 py-1 rounded">
            {(offer.validatingAirlineCodes || []).join(", ")}
          </span>
                </div>

                {/* Recommendation Score */}
                <div className="mb-2 flex items-center gap-2">
                    <Award className="w-4 h-4 text-yellow-400" />
                    <div className="text-xs text-white/70">
            <span>
              Cost: {costScore}/5 | Convenience: {convenienceScore}/5 | Overall: {overallScore}/5
            </span>
                    </div>
                </div>

                {/* Cost Breakdown Toggle Button */}
                <button
                    onClick={() => setShowCostBreakdown(!showCostBreakdown)}
                    className="text-xs flex items-center gap-1 text-white/70 hover:text-white mb-2"
                >
                    <DollarSign className="w-3 h-3" />
                    {showCostBreakdown ? "Hide cost breakdown" : "Show cost breakdown"}
                </button>

                {/* Cost Breakdown Section */}
                {showCostBreakdown && (
                    <div className="bg-white/5 p-2 rounded-md mb-3 text-xs">
                        <div className="flex justify-between mb-1">
                            <span>Base Fare:</span>
                            <span>
                {offer.price.currency === "EUR" ? `€${costBreakdown.baseFare}` : `₹${costBreakdown.baseFare}`}
              </span>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span>Taxes:</span>
                            <span>
                {offer.price.currency === "EUR" ? `€${costBreakdown.taxes}` : `₹${costBreakdown.taxes}`}
              </span>
                        </div>
                        <div className="flex justify-between mb-1">
                            <span>Airport Development Fees:</span>
                            <span>
                {offer.price.currency === "EUR" ? `€${costBreakdown.fees}` : `₹${costBreakdown.fees}`}
              </span>
                        </div>
                        {costBreakdown.discount && (
                            <div className="flex justify-between mb-1 text-green-400">
                                <span>Discount:</span>
                                <span>
                  -{offer.price.currency === "EUR" ? `€${costBreakdown.discount}` : `₹${costBreakdown.discount}`}
                </span>
                            </div>
                        )}
                        <div className="flex justify-between mt-2 pt-2 border-t border-white/10 font-medium">
                            <span>Total:</span>
                            <span>
                {offer.price.currency === "EUR" ? `€${offer.price.total}` : `₹${offer.price.total}`}
              </span>
                        </div>
                    </div>
                )}

                {/* Additional flight info */}
                {offer.reasoning && <div className="text-sm text-white/70 mt-2">{offer.reasoning}</div>}

                <div className="space-y-3 mt-3">
                    {offer.itineraries.map((itinerary, itinIndex) => (
                        <div key={itinIndex} className="border-t border-white/10 pt-2">
                            <div className="flex items-center mb-1">
                                <Clock className="w-3 h-3 mr-1 text-white/60" />
                                <span className="text-xs text-white/70">
                  Duration: {itinerary.duration || "N/A"}
                </span>
                            </div>
                            {itinerary.segments.map((segment, segIndex) => (
                                <div key={segIndex} className="text-sm my-2">
                                    <div className="flex justify-between">
                    <span className="font-medium">
                      {segment.departure.iataCode} → {segment.arrival.iataCode}
                    </span>
                                        <span className="text-xs">{segment.carrierCode || ""}</span>
                                    </div>
                                    <div className="text-xs text-white/70 flex justify-between mt-1">
                                        <span>{formatDateTime(segment.departure.at)}</span>
                                        <span>{formatDateTime(segment.arrival.at)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>

                <div className="mt-3 pt-2 border-t border-white/10 flex flex-wrap gap-2 text-xs text-white/70">
                    <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>
              Last Ticket: {new Date(offer.lastTicketingDate).toLocaleDateString("en-IN")}
            </span>
                    </div>
                    {offer.pricingOptions?.includedCheckedBagsOnly !== undefined && (
                        <div className="flex items-center">
                            <Luggage className="w-3 h-3 mr-1" />
                            <span>
                Bags: {offer.pricingOptions.includedCheckedBagsOnly ? "Included" : "Not included"}
              </span>
                        </div>
                    )}
                    <div>
                        <span>Seats: {offer.numberOfBookableSeats}</span>
                    </div>
                    {offer.pricingOptions?.fareType && (
                        <div>
                            <span>Fare: {offer.pricingOptions.fareType.join(", ")}</span>
                        </div>
                    )}
                </div>

                {/* Book Now Button */}
                <div className="mt-3">
                    <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                        Book Now
                    </Button>
                </div>
            </div>
        );
    };

    // Component to display busyness info from the backend
    const BusynessInfo = ({ info }: { info: any }) => {
        if (!info) return null;
        return (
            <div className="bg-blue-900 p-4 rounded-md mb-4 text-white">
                <h3 className="font-medium mb-2">Busiest Traveling Period Info</h3>
                {/* Display key info from the busyness info object */}
                <p>
                    <strong>Period:</strong> {info.period || "N/A"}
                </p>
                <p>
                    <strong>Rating:</strong> {info.rating || "N/A"}
                </p>
                {info.details && (
                    <p>
                        <strong>Details:</strong> {info.details}
                    </p>
                )}
            </div>
        );
    };

    // Function to create flight offers with cost breakdown and scores
    const createFlightOffers = (rawOffers: any[], userPreferences: UserPreferences): FlightOffer[] => {
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

    const generateResponse = async (query: string) => {
        setIsTyping(true);
        try {
            // Parse user preferences from the query if available
            const userPreferences: UserPreferences = {
                preferredTime: parsePreferredTime(query),
                directFlight: parseDirectFlight(query),
                maxPrice: parseMaxPrice(query),
                preferredAirline: parsePreferredAirline(query),
                travelClass: parseTravelClass(query),
            };

            // Get clientId from environment or use a default
            const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || "flight-finder-client";
            const response = await fetch("/api", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: query,
                    chatId,
                    clientId,
                    userPreferences, // Send preferences to the backend
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            let content: string | { flights: FlightOffer[]; busiestTravelingPeriod: any } = data.response;

            // If the response is an object with flight offers, process them.
            if (typeof content === "object" && "flights" in content) {
                content.flights = createFlightOffers(content.flights.slice(0, 4), userPreferences);
            } else if (Array.isArray(content)) {
                // Fallback if response is just an array.
                content = createFlightOffers(content.slice(0, 4), userPreferences);
            }

            const newResponse: Message = {
                role: "assistant",
                content,
            };

            setMessages((prev) => [...prev, newResponse]);
        } catch (error) {
            console.error("API Error:", error);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content: `Sorry, there was an error processing your request. Please try again.`,
                },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    // Parse the preferred time from the user input (if any)
    const parsePreferredTime = (query: string): "morning" | "afternoon" | "evening" | undefined => {
        const timeKeywords = [
            { term: "morning", regex: /\b(morning|early|dawn|am)\b/i },
            { term: "afternoon", regex: /\b(afternoon|noon|midday)\b/i },
            { term: "evening", regex: /\b(evening|night|late|pm)\b/i },
        ];

        for (let time of timeKeywords) {
            if (time.regex.test(query)) {
                return time.term as "morning" | "afternoon" | "evening";
            }
        }
        return undefined;
    };

    // Parse direct flight preference from user input (if any)
    const parseDirectFlight = (query: string): boolean | undefined => {
        if (/\b(direct|non-stop|nonstop|no stop|no connection)\b/i.test(query)) {
            return true;
        }
        if (/\b(layover|connection|connecting|indirect)\b/i.test(query)) {
            return false;
        }
        return undefined;
    };

    // Parse max price from user input (if any)
    const parseMaxPrice = (query: string): number | undefined => {
        const priceMatch = query.match(
            /\b(under|below|max|maximum|less than|up to)\s*[$₹€]?\s*(\d+(?:,\d+)*(?:\.\d+)?)\b/i
        );
        if (priceMatch && priceMatch[2]) {
            return parseFloat(priceMatch[2].replace(/,/g, ""));
        }
        return undefined;
    };

    // Parse preferred airline from user input (if any)
    const parsePreferredAirline = (query: string): string | undefined => {
        const airlines = [
            "Air India",
            "IndiGo",
            "SpiceJet",
            "Vistara",
            "GoAir",
            "AirAsia",
            "Lufthansa",
            "Emirates",
            "Qatar Airways",
            "British Airways",
            "Singapore Airlines",
        ];

        for (const airline of airlines) {
            if (query.toLowerCase().includes(airline.toLowerCase())) {
                return airline;
            }
        }
        return undefined;
    };

    // Parse travel class from user input (if any)
    const parseTravelClass = (
        query: string
    ): "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST" | undefined => {
        if (/\b(economy|coach)\b/i.test(query)) return "ECONOMY";
        if (/\b(premium economy|premium)\b/i.test(query)) return "PREMIUM_ECONOMY";
        if (/\b(business|business class)\b/i.test(query)) return "BUSINESS";
        if (/\b(first|first class)\b/i.test(query)) return "FIRST";
        return undefined;
    };

    const handleSendMessage = () => {
        if (!inputMessage.trim()) return;
        const newMessage: Message = {
            role: "user",
            content: inputMessage,
        };
        setMessages((prev) => [...prev, newMessage]);
        setInputMessage("");
        generateResponse(inputMessage);
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 bg-black border-b border-white/10 z-10">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <h1 className="text-xl font-light tracking-wide">Flight Finder AI</h1>
                </div>
            </div>

            {/* Chat Container */}
            <div className="max-w-3xl mx-auto px-6 pt-20 pb-24">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                    <div className="space-y-6">
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${
                                    message.role === "user" ? "justify-end" : "justify-start"
                                }`}
                            >
                                <div
                                    className={`flex items-start gap-3 max-w-[80%] ${
                                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                                    }`}
                                >
                                    <div className="mt-1">
                                        {message.role === "user" ? (
                                            <User className="w-4 h-4 text-white/40" />
                                        ) : (
                                            <Bot className="w-4 h-4 text-white/40" />
                                        )}
                                    </div>
                                    {typeof message.content === "string" ? (
                                        <div
                                            className={`font-light tracking-wide leading-relaxed ${
                                                message.role === "user" ? "text-right" : "text-left"
                                            }`}
                                        >
                                            {message.role === "assistant" ? (
                                                // Format assistant messages into bullet points
                                                <ul className="list-disc pl-5 space-y-2 text-white/80">
                                                    {message.content
                                                        .split(". ")
                                                        .filter((line) => line.trim() !== "")
                                                        .map((line, idx) => (
                                                            <li key={idx}>{line.trim()}.</li>
                                                        ))}
                                                </ul>
                                            ) : (
                                                // Regular text for user messages
                                                <p>{message.content}</p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2 w-full">
                                            {/* If the response contains busyness info, render it */}
                                            {"flights" in message.content &&
                                                message.content.busiestTravelingPeriod && (
                                                    <BusynessInfo info={message.content.busiestTravelingPeriod[0]} />
                                                )}
                                            {Array.isArray(message.content.flights) &&
                                                message.content.flights.map((offer, idx) => {
                                                    // Determine min and max prices for cost scoring
                                                    const prices = message.content.flights as FlightOffer[];
                                                    const priceValues = prices.map((f) => parseFloat(f.price.total));
                                                    const minPrice = Math.min(...priceValues);
                                                    const maxPrice = Math.max(...priceValues);

                                                    // Extract user preferences from the offer's scores
                                                    const userPreferences: UserPreferences = {
                                                        preferredTime:
                                                            parsePreferredTime(
                                                                messages.find((m) => m.role === "user")?.content as string || ""
                                                            ) || undefined,
                                                        directFlight:
                                                            parseDirectFlight(
                                                                messages.find((m) => m.role === "user")?.content as string || ""
                                                            ) || undefined,
                                                    };

                                                    return (
                                                        <FlightOfferComponent
                                                            key={idx}
                                                            offer={offer}
                                                            userPreferences={userPreferences}
                                                            minPrice={minPrice}
                                                            maxPrice={maxPrice}
                                                        />
                                                    );
                                                })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="flex items-center gap-3 text-white/40">
                                <Bot className="w-4 h-4" />
                                <span className="font-light tracking-wide">Analyzing...</span>
                            </div>
                        )}
                        <div ref={scrollRef} />
                    </div>
                </ScrollArea>
            </div>

            {/* Input Area */}
            <div className="fixed bottom-0 left-0 right-0 bg-black border-t border-white/10">
                <div className="max-w-3xl mx-auto px-6 py-4">
                    <div className="flex gap-4">
                        <Input
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                            placeholder="Tell me about your flight plans..."
                            className="bg-transparent border-0 border-b border-white/10 rounded-none text-white placeholder:text-white/30 focus:border-white/30 transition-colors font-light tracking-wide"
                        />
                        <Button
                            onClick={handleSendMessage}
                            className="bg-white text-black hover:bg-white/90 rounded-full w-10 h-10 p-0 flex items-center justify-center"
                        >
                            <SendHorizontal className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlightFinderChat;
