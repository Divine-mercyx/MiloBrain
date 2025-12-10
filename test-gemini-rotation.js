// Test script to verify Gemini API key rotation
import dotenv from "dotenv";
import { initializeAI } from './refactoredAI/aiClient.js';

dotenv.config();

// Get your Gemini API keys from environment
const geminiApiKeys = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY;

if (!geminiApiKeys) {
    console.log("Please set GEMINI_API_KEYS or GEMINI_API_KEY environment variable");
    process.exit(1);
}

async function testGeminiRotation() {
    console.log("Testing Gemini API key rotation...");
    
    // Initialize with multiple API keys
    const aiModels = initializeAI(geminiApiKeys, 'gemini');
    
    try {
        // Test a simple prompt
        const testPrompt = "Say hello world";
        console.log(`\nTesting with prompt: "${testPrompt}"`);
        
        const result = await aiModels.routerModel.generateContent(testPrompt);
        const response = await result.response;
        const text = response.text();
        
        console.log("Response:", text);
        console.log("\n✅ Gemini rotation test completed successfully!");
        
    } catch (error) {
        console.error("❌ Error in Gemini rotation test:", error.message);
    }
}

// Run the test
testGeminiRotation();