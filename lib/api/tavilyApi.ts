export async function getTavilyBookingLink(flight: any) {
    const baseURL = "https://api.tavily.com/search"; 
    const origin = flight.itineraries[0].segments[0].departure.iataCode;
    const destination = flight.itineraries[0].segments[flight.itineraries[0].segments.length - 1].arrival.iataCode;
    const date = flight.itineraries[0].segments[0].departure.at.split("T")[0];

    // Construct a query string; you might adjust this per your needs.
    const query = `book flight ${origin} to ${destination} on ${date}`;
    const apiKey = process.env.TAVILY_API_KEY; // set your Tavily API key in your environment variables
    const url = `${baseURL}?query=${encodeURIComponent(query)}${apiKey ? `&apiKey=${apiKey}` : ""}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.links && data.links.length > 0) {
            return data.links[0]; 
        }
        return "";
    } catch (error) {
        console.error("Error fetching Tavily booking link:", error);
        return "";
    }
} 