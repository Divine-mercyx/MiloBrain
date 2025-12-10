import { commandModel, aiProvider } from './aiClient.js';

export async function handleConversation(prompt, intent) {
    const conversationalPrompt = `
You are Milo, a helpful Sui blockchain assistant. 

# TONE:
- For greetings: Warm, enthusiastic, 1-2 sentences. Invite them to ask about Sui.
- For questions: Clear, concise, helpful. Explain complex topics simply - keep it short.

# USER'S MESSAGE:
"${prompt}"
`;

    const result = await commandModel.generateContent(conversationalPrompt);
    const response = await result.response;
    const message = response.text().trim();

    return {
        type: "conversational",
        intent: intent,
        message: message
    };
}