# Flight Finder Chat Application: Algorithm Explanation

This document outlines the core algorithmic concepts and data flow within the frontend of the Flight Finder chat application.

## 1. Core Interaction Flow

1.  **Initialization**:
    *   The chat interface initializes with a welcome message from the assistant.
    *   A unique `chatId` is generated for the session.

2.  **User Input**:
    *   The user types their flight requirements (departure, destination, dates, preferences) into the input field.
    *   On sending the message, the user's input is added to the `messages` state array with `role: "user"`.

3.  **Request Processing**:
    *   The application sets an `isTyping` flag to true, showing an "Analyzing..." indicator.
    *   The user's query string is passed to the `generateChatResponse` function (located in `utils/apiUtils.ts`).

4.  **Response Generation (`generateChatResponse`)**:
    *   **User Preference Parsing**:
        *   The user's query is parsed to extract explicit preferences:
            *   `parsePreferredTime`: Identifies "morning", "afternoon", "evening" keywords.
            *   `parseDirectFlight`: Checks for "direct", "non-stop" or "layover", "connection" keywords.
            *   `parseMaxPrice`: Looks for patterns like "under $500", "max €300".
            *   `parsePreferredAirline`: Matches known airline names.
            *   `parseTravelClass`: Detects "economy", "business", "first class", etc.
        *   These parsed preferences are compiled into a `UserPreferences` object.
    *   **API Call**:
        *   An HTTP POST request is made to the `/api` endpoint.
        *   The request body includes the user's message, `chatId`, a `clientId`, and the extracted `userPreferences`.
    *   **Response Handling**:
        *   The application awaits the JSON response from the API.
        *   If the API call fails, an error message is displayed.
        *   The response content can be a string (for general chat) or an object containing `flights` and `busiestTravelingPeriod` information.
    *   **Flight Offer Enhancement (`createFlightOffers` in `utils/index.ts` if response contains flights)**:
        *   If the API response contains an array of raw flight offers:
            *   The function first determines the minimum and maximum prices among the received offers to normalize cost scoring.
            *   For each flight offer, it calculates:
                *   `costScore`: Based on its price relative to the min/max prices.
                *   `convenienceScore`: Based on user preferences (timing, direct) and layover duration.
                *   `overallScore`: A weighted average of cost and convenience scores.
                *   `costBreakdown`: A sample breakdown (base fare, taxes, fees). This is generated on the frontend as a placeholder.
            *   The original offer is then augmented with this `costBreakdown` and `scores` object.
            *   Only a slice of the flight offers (e.g., top 4) are processed.
    *   **Updating Chat**:
        *   A new message object with `role: "assistant"` and the processed API response (string or enhanced flight data) is created.
        *   This new message is appended to the `messages` state array.
    *   The `isTyping` flag is set to false.

5.  **Rendering Updates**:
    *   The React component re-renders due to the change in the `messages` state.
    *   The `useEffect` hook scrolls the chat view to the newest message.
    *   The `ChatMessage` component (`components/ChatMessage.tsx`) handles the display of each message:
        *   User messages are displayed on the right; assistant messages on the left.
        *   Simple string responses from the assistant are split into bullet points.
        *   If the assistant's message content is an object:
            *   `BusynessInfoDisplay` component renders any `busiestTravelingPeriod` data.
            *   `FlightOfferCard` component renders each `FlightOffer`:
                *   Displays price (with EUR to INR conversion via `convertToRupees` if applicable).
                *   Shows calculated scores (cost, convenience, overall).
                *   Provides a toggle to show/hide the cost breakdown.
                *   Formats and displays itinerary details (departure/arrival times via `formatDateTime`, layovers via `computeLayoverDuration`).
                *   Shows other details like last ticketing date, baggage info, and bookable seats.
                *   To calculate scores within the card if not pre-calculated, or for displaying user-preference matches, it might re-evaluate user preferences based on the last user message in the `allMessages` history.

## 2. Key Algorithmic Components

### A. User Preference Parsing (`utils/index.ts`)

*   **Keyword and Regex Matching**: Each parsing function (`parsePreferredTime`, `parseDirectFlight`, etc.) uses regular expressions and string matching against a predefined set of keywords or patterns to identify relevant preferences in the user's natural language query.
    *   Example: `parseMaxPrice` uses regex to find numbers preceded by terms like "under", "max", "less than".
    *   Example: `parsePreferredAirline` iterates through a list of known `AIRLINES` (from `constants/index.ts`).

### B. Flight Scoring (`utils/index.ts`)

1.  **`calculateCostScore(flightPrice, minPrice, maxPrice)`**:
    *   Normalizes the `flightPrice` within the range of `minPrice` and `maxPrice` found in the current batch of offers.
    *   Scales this normalized value to a 1-5 score (5 being cheapest).
    *   Formula (simplified): `round(((maxPrice - flightPrice) / (maxPrice - minPrice || 1)) * 4 + 1)`

2.  **`calculateConvenienceScore(flight, userPreferences)`**:
    *   Calculates a score based on multiple factors:
        *   **Timing**: If `userPreferences.preferredTime` is set, it checks if the flight's departure hour aligns with "morning" (6-10), "afternoon" (12-16), or "evening" (17-21), awarding 5 for a match, 3 otherwise.
        *   **Direct Flight**: If `userPreferences.directFlight` is set, it awards 5 if the preference matches the flight (e.g., user wants direct and flight has 1 segment), 2 otherwise.
        *   **Layover Duration**: Calculated by `computeLayoverDuration`. Shorter layovers get higher scores (e.g., <2 hours = 5, <4 hours = 3, else = 1).
    *   The final convenience score is the average of the scores from the applicable factors. If no factors apply, a default score (e.g., 3) is returned.

3.  **`calculateOverallScore(costScore, convenienceScore, weightCost = 0.5, weightConvenience = 0.5)`**:
    *   Computes a weighted average of the `costScore` and `convenienceScore`.
    *   Default weights are 0.5 for both, but can be adjusted.

### C. Data Transformation & Display Utilities (`utils/index.ts`)

*   **`convertToRupees(euroAmount)`**: Converts EUR string to INR string using a fixed `EUR_TO_INR` exchange rate.
*   **`formatDateTime(dateTimeString)`**: Converts an ISO date-time string to a locale-specific string (e.g., "en-IN").
*   **`computeLayoverDuration(flight)`**:
    *   Checks if a flight has multiple segments.
    *   If so, iterates through segments, calculating the time difference between the arrival of `segment[i-1]` and the departure of `segment[i]`.
    *   Sums these differences to get the total layover time in hours.
*   **`generateCostBreakdown(totalPrice)`**:
    *   A simplified placeholder function that splits the `totalPrice` into arbitrary percentages for base fare (70%), taxes (20%), and fees (10%). In a real application, this would come from the API.

## 3. State Management

*   **`useState`**: Used extensively in `FlightFinderChat` (`page.tsx`) to manage:
    *   `messages`: The array of chat messages.
    *   `inputMessage`: The current content of the text input.
    *   `isTyping`: Boolean to show/hide the typing indicator.
    *   `chatId`: A stable ID for the current chat session.
    *   `showCostBreakdown` (within `FlightOfferCard.tsx`): Toggles visibility of the cost details.
*   **`useRef`**: `scrollRef` is used to get a reference to the bottom of the chat messages list, allowing automatic scrolling via `scrollIntoView()`.
*   **`useEffect`**: The effect hook watching the `messages` array ensures that the view scrolls to the latest message whenever a new message is added.

This explanation covers the primary logic implemented in the frontend. The backend API (`/api`) is treated as a black box from the frontend's perspective, only its request/response contract is relevant here. 