const AmadeusApiData = {
    npm: { // Covers package-related info
        packageName: "",
        installation: "",
        description: "",
        link: ""
    },
    api: { // Covers API connection details
        baseUrl: "test.api.amadeus.com",
        authentication: {
            method: "",
            keyOrId: "",
            secret: "",
            tokenEndpoint: ""
        },
        rateLimits: {
            requestsPerSecond: "",
            note: ""
        },
        documentation: ""
    },
    query: { // Covers API request structure
        primaryEndpoint: {
            endpoint: "",
            method: "",
            parameters: {
                required: {},
                optional: {}
            }
        }
        // Room to add more endpoints
    },
    naming: { // Covers naming conventions
        variables: "",
        endpoints: "",
        headers: "",
        note: ""
    },
    responses: { // Covers response formats
        primaryEndpoint: {
            success: {
                status: "",
                contentType: "",
                structure: {}
            },
            error: {
                status: "",
                contentType: "",
                structure: {}
            }
        }
    }
};

const FlightSearchPayload = {
    originLocationCode: 'SYD',
    destinationLocationCode: 'BKK',
    departureDate: '2022-10-21',
    adults: '2'
};

export { AmadeusApiData, FlightSearchPayload };