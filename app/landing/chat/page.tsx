"use client";

import React, { useState, useEffect, useRef } from "react";
import { SendHorizontal, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

// Define types for the flight offer and messages
interface Segment {
    departure: {
        iataCode: string;
    };
    arrival: {
        iataCode: string;
    };
}

interface Itinerary {
    segments: Segment[];
}

interface FlightOfferData {
    price: {
        total: string;
        currency: string;
    };
    validatingAirlineCodes: string[];
    itineraries: Itinerary[];
    numberOfBookableSeats: number;
    lastTicketingDate: string;
}

interface Message {
    role: "user" | "assistant";
    content: string | FlightOfferData | FlightOfferData[];
}

const FlightFinderChat: React.FC = () => {
    const [chatId] = useState<number>(Date.now());
    const [messages, setMessages] = useState<Message[]>([
        {
            role: "assistant",
            content: "I'm here to help with your flight plans. What are your preferences?",
        },
    ]);
    const [inputMessage, setInputMessage] = useState<string>("");
    const [isTyping, setIsTyping] = useState<boolean>(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // FlightOffer component with typed props
    const FlightOffer: React.FC<{ offer: FlightOfferData }> = ({ offer }) => (
        <div className="bg-black border border-white/20 p-3 rounded-md mb-2 text-white">
            <div className="flex justify-between items-center">
        <span className="text-lg font-medium">
          {offer.price.total} {offer.price.currency}
        </span>
                <span className="text-sm">
          {offer.validatingAirlineCodes.join(", ")}
        </span>
            </div>
            <div className="mt-2">
                {offer.itineraries.slice(0, 5).map((itinerary, index) => (
                    <div key={index} className="text-sm">
            <span>
              {itinerary.segments[0].departure.iataCode} →{" "}
                {itinerary.segments[itinerary.segments.length - 1].arrival.iataCode}
            </span>
                    </div>
                ))}
            </div>
            <div className="mt-1 text-xs text-white/70">
                <span>Seats: {offer.numberOfBookableSeats}</span> |{" "}
                <span>Last Ticket: {new Date(offer.lastTicketingDate).toLocaleDateString()}</span>
            </div>
        </div>
    );

    const generateResponse = async (query: string): Promise<void> => {
        setIsTyping(true);
        try {
            const response = await fetch("/api/", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ message: query, chatId }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            let content: string | FlightOfferData | FlightOfferData[] =
                typeof data.response === "string" ? data.response : data.response;

            if (Array.isArray(content)) {
                content = content.slice(0, 4);
            }

            const newResponse: Message = { role: "assistant", content };
            setMessages((prev) => [...prev, newResponse]);
        } catch (error) {
            console.error("API Error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Error: ${(error as Error).message}` },
            ]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleSendMessage = (): void => {
        if (!inputMessage.trim()) return;
        const newMessage: Message = { role: "user", content: inputMessage };
        setMessages((prev) => [...prev, newMessage]);
        setInputMessage("");
        void generateResponse(inputMessage);
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
                                                message.content.map((offer, idx) => (
                                                    <FlightOffer key={idx} offer={offer} />
                                                ))
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
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setInputMessage(e.target.value)
                            }
                            onKeyPress={(e: React.KeyboardEvent<HTMLInputElement>) =>
                                e.key === "Enter" && handleSendMessage()
                            }
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