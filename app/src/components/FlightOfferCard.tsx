import React, { useState } from "react";
import { Award, Calendar, Clock, DollarSign, Luggage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlightOffer, UserPreferences } from "../types";
import { convertToRupees, formatDateTime, calculateCostScore, calculateConvenienceScore, calculateOverallScore, generateCostBreakdown } from "../utils";

interface FlightOfferCardProps {
    offer: FlightOffer;
    userPreferences: UserPreferences;
    minPrice: number;
    maxPrice: number;
}

const FlightOfferCard: React.FC<FlightOfferCardProps> = ({ offer, userPreferences, minPrice, maxPrice }) => {
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

export default FlightOfferCard; 