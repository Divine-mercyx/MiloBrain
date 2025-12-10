// Test script to verify backend Claude integration
import dotenv from "dotenv";
import { aiProvider } from './AI/lib/aiClient.js';
import { routeIntent } from './AI/lib/router.js';
import { handleCommand } from './AI/lib/commandHandler.js';

dotenv.config();

// Example contacts list
const contacts = [
    { name: "John", address: "0x123456789abcdef" },
    { name: "Alex", address: "0xabcdef123456789" },
    { name: "Sarah", address: "0x987654321fedcba" }
];

async function testBackendClaudeIntegration() {
    console.log(`Testing backend AI integration with provider: ${aiProvider}`);
    
    try {
        // Test 1: Route intent
        const testPrompt = "Send 5 SUI to John";
        console.log(`\nRouting intent for: "${testPrompt}"`);
        const intentResult = await routeIntent(testPrompt);
        console.log("Intent result:", JSON.stringify(intentResult, null, 2));
        
        // Test 2: Handle command
        console.log(`\nHandling command: "${testPrompt}"`);
        const commandResult = await handleCommand(testPrompt, contacts);
        console.log("Command result:", JSON.stringify(commandResult, null, 2));
        
        console.log("\n✅ Backend tests completed successfully!");
        
    } catch (error) {
        console.error("❌ Error in backend test:", error.message);
        console.error("Stack trace:", error.stack);
    }
}

// Run the test
testBackendClaudeIntegration();