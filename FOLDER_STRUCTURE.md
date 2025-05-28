# Folder Structure

This document explains the main folder structure of the project.

## Root Level (`./`)

*   **`app/`**: Contains Next.js specific files like page components, layouts, and API routes.
    *   `api/`: Contains API route handlers.
        *   `route.ts`: Main API route handler for chat/flight search.
    *   `page.tsx`: The main page component for the application's root route.
    *   `layout.tsx`: The main layout component for the application.
    *   `globals.css`: Global CSS styles.
    *   `favicon.ico`: The favicon for the website.
    *   Other Next.js related directories like `auth/`, `sign-in/`, `sign-up/` for specific routes.
*   **`components/`**: Contains reusable UI components (React components).
*   **`hooks/`**: Contains custom React hooks.
    *   `useFlightSearch.ts`: Hook for flight search functionality on the client-side.
*   **`lib/`**: Contains backend-focused libraries, utilities, services, and configurations.
    *   `ai/`:
        *   `aiUtils.ts`: Utilities related to AI model interactions (OpenAI, Gemini).
    *   `api/`:
        *   `amadeusApi.ts`: Utilities for interacting with the Amadeus API.
        *   `tavilyApi.ts`: Utilities for interacting with the Tavily Search API.
    *   `prompts/`:
        *   `flightSearchPrompts.ts`: Stores complex prompt strings for AI models.
    *   `services/`:
        *   `flightService.ts`: Handles the core business logic for flight processing.
    *   `utils/`:
        *   `flightUtils.ts`: General utility functions related to flight data calculations.
        *   `redisUtils.ts`: Utilities for interacting with Redis.
*   **`public/`**: Contains static assets to be served directly.
