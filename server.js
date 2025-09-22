import fastify from "fastify";
import dotenv from "dotenv";
import cors from "@fastify/cors";
import responseRoute from "./AI/route/ResponseRoute.js";
import nodeCron from "node-cron";
import axios from "axios";
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = fastify();
app.register(cors);
app.register(responseRoute, { prefix: '/api/v1/ai' });

const start = async () => {
    try {
        await app.listen({ port: PORT, host: '0.0.0.0' });
        console.log(`Server is running on port ${PORT}`);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

const serverUrl = "https://milobrain.onrender.com";

nodeCron.schedule("*/10 * * * *", async () => {
    try {
        await axios.get(serverUrl);
        console.log("Pinged server to keep it awake");
    } catch (error) {
        console.error("Failed to ping server:", error.message);
    }
})

start();
