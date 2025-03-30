"use client";

import React, { useState, useEffect, useRef } from "react";
import { SendHorizontal, Bot, User, Calendar, Clock, Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const ResponseFormatter = ({ response }) => {
    // Function to format paragraphs with consistent styling
    const formatParagraphs = (text) => {
        // Split the response by double line breaks or numbered/bullet points
        const paragraphs = text.split(/\n\n|\r\n\r\n|(?=\d+\.\s)/).filter(p => p.trim().length > 0);
        return paragraphs.map((paragraph, index) => {
            // Handle specifically formatted sections like numbered lists
            if (paragraph.match(/^\d+\.\s\*\*.+?\*\*:/)) {
                // This is a titled point (like "1. **Distance and Travel Time:**")
                const [title, ...content] = paragraph.split(/(?<=:)/).map(p => p.trim());
                return (
                    <div key={index} className="mb-4">
                        <h3 className="text-white font-medium mb-2">{title}</h3>
                        <p className="text-white/70 font-light tracking-wide leading-relaxed">
                            {content.join(' ')} <br/>
                        </p>
                    </div>
                );
            } else {
                // Regular paragraph
                return (
                    <p key={index} className="text-white/90 font-light tracking-wide leading-relaxed mb-4">
                        {paragraph}
                    </p>
                );
            }
        });
    };

    return (
        <div className="space-y-2">
            {formatParagraphs(response)}
        </div>
    );
};

// Exchange rate - EUR to INR (as of March 2025, this is an approximation)
const EUR_TO_INR = 92.5;

const FlightFinderChat = () => {
    const [chatId] = useState(Date.now());
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: "I'm here to help with your flight plans. Tell me your departure city, destination, dates, and any other preferences you have!",
        },
    ]);
    const [inputMessage, setInputMessage] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef(null);

    // Function to convert EUR to INR
    const convertToRupees = (euroAmount) => {
        const amount = parseFloat(euroAmount);
        const rupeesAmount = (amount * EUR_TO_INR).toFixed(2);
        return rupeesAmount;
    };

    // Format date and time for better readability
    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return "N/A";
        return new Date(dateTimeString).toLocaleString("en-IN");
    };

    // Function to compute layover duration in hours (if any)
    const computeLayoverDuration = (flight) => {
        if (flight.itineraries[0].segments.length > 1) {
            let totalLayover = 0;
            for (let i = 1; i < flight.itineraries[0].segments.length; i++) {
                const prevArrival = new Date(flight.itineraries[0].segments[i - 1].arrival.at);
                const currDeparture = new Date(flight.itineraries[0].segments[i].departure.at);
                totalLayover += (currDeparture - prevArrival) / (1000 * 60 * 60); // in hours
            }
            return totalLayover;
        }
        return 0;
    };

    // Calculate cost score (1 to 5)
    const calculateCostScore = (flightPrice, minPrice, maxPrice) => {
        // Normalize the price so that the cheapest gets a 5 and the most expensive a 1.
        const normalized = (maxPrice - flightPrice) / (maxPrice - minPrice || 1);
        return Math.round(normalized * 4 + 1); // scale between 1 and 5
    };

    // Calculate convenience score based on timing, direct flights, and layover duration.
    const calculateConvenienceScore = (flight, userPreferences) => {
        let score = 0;
        let factors = 0;

        // Example factor: Flight Timing
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

        // Example factor: Direct Flight preference
        if (userPreferences.directFlight !== undefined) {
            score += (userPreferences.directFlight && flight.itineraries[0].segments.length === 1) ? 5 : 2;
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
    const calculateOverallScore = (costScore, convenienceScore, weightCost = 0.5, weightConvenience = 0.5) => {
        return Math.round(costScore * weightCost + convenienceScore * weightConvenience);
    };

    // Generate Tavily booking link (example using query parameters)
    const generateTavilyBookingLink = (flight) => {
        const baseURL = "https://www.tavily.com/search";
        const origin = flight.itineraries[0].segments[0].departure.iataCode;
        const destination = flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival.iataCode;
        const date = flight.itineraries[0].segments[0].departure.at.split("T")[0];
        const params = new URLSearchParams({ origin, destination, date });
        return `${baseURL}?${params.toString()}`;
    };

    // FlightOffer component with recommendation score and booking link
    const FlightOffer = ({ offer, userPreferences, minPrice, maxPrice }) => {
        // Convert price to rupees if currency is EUR
        const priceDisplay = offer.price.currency === "EUR"
            ? `₹${convertToRupees(offer.price.total)} (€${offer.price.total})`
            : `₹${offer.price.total}`;

        // Calculate cost score and convenience score
        const costScore = calculateCostScore(parseFloat(offer.price.total), minPrice, maxPrice);
        const convenienceScore = calculateConvenienceScore(offer, userPreferences);
        const overallScore = calculateOverallScore(costScore, convenienceScore);

        // Generate booking link for Tavily
        const bookingLink = generateTavilyBookingLink(offer);

        return (
            <div className="bg-black border border-white/20 p-4 rounded-md mb-3 text-white">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-lg font-medium">{priceDisplay}</span>
                    <span className="text-sm bg-white/10 px-2 py-1 rounded">
            {(offer.validatingAirlineCodes || []).join(", ")}
          </span>
                </div>

                {/* Recommendation Score */}
                <div className="mb-2 text-xs text-white/70">
                    <span>Cost Score: {costScore} | Convenience Score: {convenienceScore} | Overall: {overallScore} / 5</span>
                </div>

                {/* Additional flight info */}
                {offer.reasoning && (
                    <div className="text-sm text-white/70 mt-2">{offer.reasoning}</div>
                )}

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

                {/* Transit information */}
                {offer.transitRoutes && (
                    <div className="mt-2 text-sm text-white/70">{offer.transitRoutes}</div>
                )}

                {/* Family/solo consideration */}
                {offer.familySoloConsideration && (
                    <div className="mt-2 text-sm text-white/70">{offer.familySoloConsideration}</div>
                )}

                {/* Morning/night comparison */}
                {offer.morningNightComparison && (
                    <div className="mt-2 text-sm text-white/70">{offer.morningNightComparison}</div>
                )}

                {/* Visa information */}
                {offer.visaInfo && (
                    <div className="mt-2 text-sm text-white/70">{offer.visaInfo}</div>
                )}

                <div className="mt-3 pt-2 border-t border-white/10 flex flex-wrap gap-2 text-xs text-white/70">
                    <div className="flex items-center">
                        <Calendar className="w-3 h-3 mr-1" />
                        <span>Last Ticket: {new Date(offer.lastTicketingDate).toLocaleDateString("en-IN")}</span>
                    </div>
                    {offer.pricingOptions?.includedCheckedBagsOnly !== undefined && (
                        <div className="flex items-center">
                            <Luggage className="w-3 h-3 mr-1" />
                            <span>Bags: {offer.pricingOptions.includedCheckedBagsOnly ? "Included" : "Not included"}</span>
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

                {/* Tavily Booking Link */}
                {/*<div className="mt-3">*/}
                {/*    <a href={bookingLink} target="_blank" rel="noopener noreferrer" className="text-blue-400 text-sm underline">*/}
                {/*        Book via Tavily*/}
                {/*    </a>*/}
                {/*</div>*/}
            </div>
        );
    };

    const generateResponse = async (query) => {
        setIsTyping(true);
        try {
            // Get clientId from environment or use a default
            const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || "flight-finder-client";
            const response = await fetch("/api", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: query,
                    chatId,
                    clientId
                }),
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            let content = data.response;
            // If content is an array, limit to 4 options
            if (Array.isArray(content)) {
                content = content.slice(0, 4);
            }
            const newResponse = { role: "assistant", content };
            setMessages((prev) => [...prev, newResponse]);
        } catch (error) {
            console.error("API Error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Sorry, there was an error processing your request. Please try again.` },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSendMessage = () => {
        if (!inputMessage.trim()) return;
        const newMessage = { role: "user", content: inputMessage };
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
                                            {message.content}
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {Array.isArray(message.content) ? (
                                                message.content.map((offer, idx) => {
                                                    // Determine min and max prices for cost scoring
                                                    const prices = message.content.map(f => parseFloat(f.price.total));
                                                    const minPrice = Math.min(...prices);
                                                    const maxPrice = Math.max(...prices);
                                                    // For demonstration, here we use hardcoded user preferences.
                                                    const userPreferences = {
                                                        preferredTime: "morning", // or "afternoon", "evening"
                                                        directFlight: true,
                                                    };
                                                    return (
                                                        <FlightOffer
                                                            key={idx}
                                                            offer={offer}
                                                            userPreferences={userPreferences}
                                                            minPrice={minPrice}
                                                            maxPrice={maxPrice}
                                                        />
                                                    );
                                                })
                                            ) : (
                                                <FlightOffer offer={message.content} />
                                            )}
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
                            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                            placeholder="Tell me about your flight plans..."
                            className="bg-transparent border-0 border-b border-white/10 rounded-none
                text-white placeholder:text-white/30 focus:border-white/30
                transition-colors font-light tracking-wide"
                        />
                        <Button
                            onClick={handleSendMessage}
                            className="bg-white text-black hover:bg-white/90 rounded-full w-10 h-10 p-0
                flex items-center justify-center"
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
