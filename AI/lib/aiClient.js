import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("The GEMINI_API_KEY environment variable is not set.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// Export configured models
export const routerModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
export const commandModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
