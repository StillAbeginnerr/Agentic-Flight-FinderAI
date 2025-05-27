import { UserPreferences, FlightOffer, Message } from "../types";
import { createFlightOffers, parseDirectFlight, parseMaxPrice, parsePreferredAirline, parsePreferredTime, parseTravelClass } from ".";

export const generateChatResponse = async (
    query: string,
    chatId: number,
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
    setIsTyping: React.Dispatch<React.SetStateAction<boolean>>
) => {
    setIsTyping(true);
    try {
        const userPreferences: UserPreferences = {
            preferredTime: parsePreferredTime(query),
            directFlight: parseDirectFlight(query),
            maxPrice: parseMaxPrice(query),
            preferredAirline: parsePreferredAirline(query),
            travelClass: parseTravelClass(query),
        };

        const clientId = process.env.NEXT_PUBLIC_CLIENT_ID || "flight-finder-client";
        const response = await fetch("/api", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: query,
                chatId,
                clientId,
                userPreferences,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        let content: string | { flights: FlightOffer[]; busiestTravelingPeriod: any } = data.response;

        if (typeof content === 'object' && content && "flights" in content && Array.isArray(content.flights)) {
            content.flights = createFlightOffers(content.flights.slice(0, 4), userPreferences);
        } else if (Array.isArray(content)) {
            content = { flights: createFlightOffers(content.slice(0, 4) as FlightOffer[], userPreferences), busiestTravelingPeriod: null };
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