import { NextConfig } from "next";
import dotenv from "dotenv";

dotenv.config();

const nextConfig: NextConfig = {
    env: {
        AMADEUS_CLIENT_ID: process.env.AMADEUS_CLIENT_ID,
        AMADEUS_CLIENT_SECRET: process.env.AMADEUS_CLIENT_SECRET,
    },
};

export default nextConfig;
