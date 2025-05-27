import React from 'react';
import { Bot, User } from 'lucide-react';
import { Message, FlightOffer, UserPreferences } from '../types';
import FlightOfferCard from './FlightOfferCard';
import BusynessInfoDisplay from './BusynessInfoDisplay';
import { parseDirectFlight, parsePreferredTime } from '../utils';

interface ChatMessageProps {
    message: Message;
    allMessages: Message[];
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, allMessages }) => {
    const findLastUserMessageContent = () => {
        for (let i = allMessages.length - 1; i >= 0; i--) {
            if (allMessages[i].role === 'user') {
                return allMessages[i].content as string;
            }
        }
        return "";
    };

    return (
        <div
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
                            <ul className="list-disc pl-5 space-y-2 text-white/80">
                                {message.content
                                    .split(". ")
                                    .filter((line) => line.trim() !== "")
                                    .map((line, idx) => (
                                        <li key={idx}>{line.trim()}.</li>
                                    ))}
                            </ul>
                        ) : (
                            <p>{message.content}</p>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 w-full">
                        {typeof message.content !== 'string' && "busiestTravelingPeriod" in message.content && message.content.busiestTravelingPeriod && (
                            <BusynessInfoDisplay info={message.content.busiestTravelingPeriod[0]} />
                        )}
                        {(typeof message.content === 'object' && message.content && "flights" in message.content && Array.isArray(message.content.flights)) && (
                            (() => {
                                const flights = message.content.flights; 
                                
                                // Calculate min/max price and user preferences once for all flights
                                const priceValues = flights.map((f: FlightOffer) => parseFloat(f.price.total));
                                const minPrice = Math.min(...priceValues);
                                const maxPrice = Math.max(...priceValues);
                                const lastUserQuery = findLastUserMessageContent();
                                const userPreferences: UserPreferences = {
                                    preferredTime: parsePreferredTime(lastUserQuery) || undefined,
                                    directFlight: parseDirectFlight(lastUserQuery) || undefined,
                                };

                                return flights.map((offer: FlightOffer, idx: number) => (
                                    <FlightOfferCard
                                        key={idx}
                                        offer={offer}
                                        userPreferences={userPreferences}
                                        minPrice={minPrice}
                                        maxPrice={maxPrice}
                                    />
                                ));
                            })()
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage; 