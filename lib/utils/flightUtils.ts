export const getTotalDuration = (duration: string) => {
    const hours = parseInt(duration.match(/(\d+)H/)?.[1] || "0");
    const minutes = parseInt(duration.match(/(\d+)M/)?.[1] || "0");
    return hours + minutes / 60;
};

export const isMorningFlight = (departureTime: string) => {
    const hour = new Date(departureTime).getUTCHours();
    return hour >= 5 && hour < 12;
};

export const isNightFlight = (departureTime: string) => {
    const hour = new Date(departureTime).getUTCHours();
    return hour >= 18 || hour < 5;
};

export const calculateCostScore = (flightPrice: number, minPrice: number, maxPrice: number) => {
    const normalized = (maxPrice - flightPrice) / (maxPrice - minPrice || 1);
    return Math.round(normalized * 4 + 1);
};

export const computeLayoverDuration = (flight: any) => {
    if (flight.itineraries[0].segments.length > 1) {
        let totalLayover = 0;
        for (let i = 1; i < flight.itineraries[0].segments.length; i++) {
            const prevArrival: any = new Date(flight.itineraries[0].segments[i - 1].arrival.at);
            const currDeparture: any = new Date(flight.itineraries[0].segments[i].departure.at);
            totalLayover += (currDeparture - prevArrival) / (1000 * 60 * 60);
        }
        return totalLayover;
    }
    return 0;
};

export const calculateConvenienceScore = (flight: any, userPreferences: any) => {
    let score = 0;
    let factors = 0;

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

    if (userPreferences.directFlight !== undefined) {
        score += (userPreferences.directFlight && flight.itineraries[0].segments.length === 1) ? 5 : 2;
        factors++;
    }

    const layoverDuration = computeLayoverDuration(flight);
    if (layoverDuration !== undefined) {
        if (layoverDuration < 2) score += 5;
        else if (layoverDuration < 4) score += 3;
        else score += 1;
        factors++;
    }

    return factors > 0 ? Math.round(score / factors) : 3;
};

export const calculateOverallScore = (costScore: number, convenienceScore: number, weightCost = 0.5, weightConvenience = 0.5) => {
    return Math.round(costScore * weightCost + convenienceScore * weightConvenience);
}; 