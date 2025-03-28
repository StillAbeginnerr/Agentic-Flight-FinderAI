"use client";

import React, { useState, useEffect, useRef } from "react";
import { SendHorizontal, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

const FlightFinderChat = () => {
    const [chatId] = useState(Date.now());
    const [messages, setMessages] = useState([
        {
            role: "assistant",
            content: "I'm here to help with your flight plans. What are your preferences?",
        },
    ]);
    const [inputMessage, setInputMessage] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef(null);

    // Minimalistic FlightOffer component in black and white
    const FlightOffer = ({ offer }) => (
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

    const generateResponse = async (query) => {
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
            let content = typeof data.response === "string" ? data.response : data.response;
            // Limit to 4 flight offers if it's an array
            if (Array.isArray(content)) {
                content = content.slice(0, 4);
            }
            const newResponse = { role: "assistant", content };
            setMessages((prev) => [...prev, newResponse]);
        } catch (error) {
            console.error("API Error:", error);
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Error: ${error.message}` },
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