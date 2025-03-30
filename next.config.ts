import { NextConfig } from "next";
import dotenv from "dotenv";

dotenv.config();

const nextConfig: NextConfig = {
    env: {
        AMADEUS_CLIENT_ID: process.env.AMADEUS_CLIENT_ID,
        AMADEUS_CLIENT_SECRET: process.env.AMADEUS_CLIENT_SECRET,
    },
    eslint: {
        // Disable ESLint during production build
        ignoreDuringBuilds: true,
    },
};

export default nextConfig;
