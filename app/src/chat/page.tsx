"use client";

import React, { useState, useEffect, useRef } from "react";
import { SendHorizontal, Bot, User, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Message } from "../types";
import { generateChatResponse } from "../utils/apiUtils";
import ChatMessage from "../components/ChatMessage";
import { UserButton } from "@clerk/nextjs";

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

    const handleSendMessage = () => {
        if (!inputMessage.trim()) return;
        const newMessage: Message = {
            role: "user",
            content: inputMessage,
        };
        setMessages((prev) => [...prev, newMessage]);
        setInputMessage("");
        generateChatResponse(inputMessage, chatId, setMessages, setIsTyping);
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
                <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
                    <h1 className="text-xl font-light tracking-wide">Flight Finder AI</h1>
                    <UserButton afterSignOutUrl="/">
                        <UserButton.MenuItems>
                            <UserButton.Link
                                label="View Plans"
                                href="/pricing"
                                labelIcon={<CreditCard className="w-4 h-4" />}
                            />
                        </UserButton.MenuItems>
                    </UserButton>
                </div>
            </div>

            {/* Chat Container */}
            <div className="max-w-3xl mx-auto px-6 pt-20 pb-24">
                <ScrollArea className="h-[calc(100vh-12rem)]">
                    <div className="space-y-6">
                        {messages.map((message, index) => (
                            <ChatMessage key={index} message={message} allMessages={messages} />
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
