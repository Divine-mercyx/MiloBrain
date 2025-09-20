export function parseGeminiResponse(text) {
    try {
        const jsonString = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", text);
        throw new Error("AI generated an invalid response.");
    }
}

export function validateRequest(prompt) {
    if (!prompt || typeof prompt !== 'string') {
        throw new Error("Invalid request: 'prompt' must be a string.");
    }
}
