import { routerModel, aiProvider } from './aiClient.js';
import {parseGeminiResponse} from "./utils.js";

export async function routeIntent(prompt) {
    const routerPrompt = `
Classify the user's intent. 
- "command": They want to PERFORM A BLOCKCHAIN ACTION (send, transfer, swap, check balance)
- "question": They are asking HOW or WHAT about blockchain (even if it contains action words)  
- "greeting": Simple hello, hi, how are you, thanks

Respond with ONLY JSON: {"intent":"command"|"question"|"greeting"}

Message: "${prompt}"
`;

    const result = await routerModel.generateContent(routerPrompt);
    const response = await result.response;
    const text = response.text();

    // Use appropriate parser based on provider
    if (aiProvider === 'claude') {
        try {
            const jsonString = text.replace(/```json|```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (parseError) {
            console.error("Failed to parse AI response as JSON:", text);
            throw new Error("AI generated an invalid response.");
        }
    } else {
        return parseGeminiResponse(text);
    }
}