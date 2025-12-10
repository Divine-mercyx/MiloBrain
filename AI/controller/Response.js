import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
dotenv.config();

// Check for API keys
const geminiApiKeys = process.env.GEMINI_API_KEYS ? process.env.GEMINI_API_KEYS.split(',') : 
                     process.env.GEMINI_API_KEY ? [process.env.GEMINI_API_KEY] : [];
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

// Track current API key index for rotation
let currentGeminiKeyIndex = 0;

// Function to get current Gemini API key
function getCurrentGeminiKey() {
    if (geminiApiKeys.length === 0) return null;
    return geminiApiKeys[currentGeminiKeyIndex];
}

// Function to rotate to next Gemini API key
function rotateGeminiKey() {
    if (geminiApiKeys.length > 1) {
        currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiApiKeys.length;
        console.log(`Rotating to Gemini API key ${currentGeminiKeyIndex + 1}/${geminiApiKeys.length}`);
        return true;
    }
    return false;
}

// Initialize the appropriate AI provider
let aiProvider = 'gemini'; // default
let model = null;

if (anthropicApiKey) {
    // Use Claude if Anthropic API key is available
    aiProvider = 'claude';
    const anthropic = new Anthropic({
        apiKey: anthropicApiKey
    });
    
    // Create a wrapper to match Gemini's API
    model = {
        generateContent: async (prompt) => {
            let actualPrompt = prompt;
            if (typeof prompt === 'object' && prompt.contents) {
                // Handle Gemini-style prompts
                actualPrompt = prompt.contents[0].parts.find(part => part.text)?.text || '';
            } else if (typeof prompt === 'string') {
                actualPrompt = prompt;
            }
            
            const message = await anthropic.messages.create({
                model: "claude-3-5-sonnet-20251022",
                max_tokens: 1000,
                messages: [{ role: "user", content: actualPrompt }]
            });
            
            return {
                response: Promise.resolve({
                    text: () => message.content[0].text
                })
            };
        }
    };
} else if (geminiApiKeys.length > 0) {
    // Use Gemini with API key rotation
    aiProvider = 'gemini';
    
    // Create a wrapper that handles API key rotation
    model = {
        generateContent: async (prompt) => {
            let lastError;
            let attempts = 0;
            const maxAttempts = geminiApiKeys.length || 1;
            
            while (attempts < maxAttempts) {
                try {
                    const currentKey = getCurrentGeminiKey();
                    if (!currentKey) {
                        throw new Error("No valid Gemini API key available");
                    }
                    
                    const genAI = new GoogleGenerativeAI(currentKey);
                    const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
                    return await geminiModel.generateContent(prompt);
                } catch (error) {
                    lastError = error;
                    console.error(`Gemini API key ${currentGeminiKeyIndex + 1} failed:`, error.message);
                    
                    // If it's an authentication error, rotate to the next key
                    if (error.message.includes('API_KEY_INVALID') || error.message.includes('401')) {
                        if (rotateGeminiKey()) {
                            attempts++;
                            continue; // Try with the next key
                        } else {
                            break; // No more keys to try
                        }
                    } else {
                        // For non-authentication errors, don't rotate
                        break;
                    }
                }
            }
            
            // If we get here, all keys have failed
            throw lastError || new Error("All Gemini API keys failed");
        }
    };
    
    console.log(`AI Controller initialized with Gemini using ${geminiApiKeys.length} API keys`);
} else {
    throw new Error("Either GEMINI_API_KEYS or ANTHROPIC_API_KEY environment variable must be set.");
}

console.log(`AI Controller initialized with provider: ${aiProvider}`);

export const response = async (req, res) => {
    try {
        const { prompt, contacts } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).send({ error: "Invalid request: 'prompt' must be a string." });
        }

        const systemPrompt = `
You are "Milo", an AI assistant that parses natural language commands for the Sui blockchain. Your ONLY task is to convert the user's command into a specific, structured JSON format.

# USER CONTEXT
The user has provided their contact list: ${JSON.stringify(contacts || [])}
If a name is used (e.g., "send to Alex"), you MUST look it up in the contact list and use the associated address. If the name is not found, you must use an "error" action.

# VALIDATION RULES - YOU MUST ENFORCE THESE
1.  The only valid assets for the 'transfer' action are: **SUI, USDC, USDT, CETUS, WETH**. If the user specifies any other asset (like 'rubbish', 'doge', 'banana'), the action must be "error".
2.  The 'amount' must be a number. ***You MUST convert common number words (e.g., 'one', 'two', 'ten', 'ise', 'iri') into their numerical digit form (e.g., '1', '2', '10', '5', '10') before outputting the JSON.*** If the amount cannot be converted to a number, the action must be "error".
# OUTPUT RULES
1. Your output must be ONLY valid JSON. No other text, no explanations, no markdown.
2. You must choose the correct JSON structure based on the user's intent and ENFORCE THE VALIDATION RULES above.
3. ***CRITICAL: YOU MUST DETECT THE USER'S LANGUAGE AND WRITE THE ERROR MESSAGE IN THAT SAME LANGUAGE.*** If the user writes in French, the error message must be in French. If the user writes in Yoruba, the error message must be in Yoruba.

# AVAILABLE COMMANDS AND THEIR JSON STRUCTURE

## 1. TRANSFER TOKENS
- Intent: User wants to send tokens to another address.
- JSON: 
{ 
  "action": "transfer", // << This stays in English, it's a code keyword
  "asset": "SUI",       // << This stays in English, it's a ticker symbol
  "amount": "5",        // << This is a number
  "recipient": "0x..."  // << This is a hex address
  "reply": "Sending 5 SUI to Jacob. Sign transaction to continue." // << This is a human-readable confirmation
 }

## 2. VIEW BALANCE (Query)
- Intent: User asks about their portfolio or balance.
- JSON: 
{ 
  "action": "query_balance" // << This stays in English, it's a code keyword
}

## 3. SWAP TOKENS
- Intent: User wants to exchange one token for another.
- JSON: 
{ 
  "action": "swap",         // << This stays in English
  "fromAsset": "SUI",       // << This stays in English
  "toAsset": "USDC",        // << This stays in English
  "amount": "5",            // << This is a number
  "reply": "Swapping SUI to USDC. Sign transaction to continue." // << This is a human-readable confirmation
}

## 4. ERROR HANDLING
- Intent: The command is unknown, ambiguous, uses an invalid asset, a non-numeric amount, or a contact name is missing.
- JSON: 
{ 
  "action": "error",
  "message": "Detailed error message here. [WRITE THIS MESSAGE IN THE USER'S DETECTED LANGUAGE]." 
}

# USER'S COMMAND:
"${prompt}"
`;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const responseText = response.text();

        let parsedResponse;
        try {
            // Use appropriate parser based on provider
            if (aiProvider === 'claude') {
                const jsonString = responseText.replace(/```json|```/g, '').trim();
                parsedResponse = JSON.parse(jsonString);
            } else {
                const jsonString = responseText.replace(/```json|```/g, '').trim();
                parsedResponse = JSON.parse(jsonString);
            }
        } catch (parseError) {
            console.error("AI Response was not valid JSON:", responseText);
            parsedResponse = {
                action: "error",
                message: "Sorry, I encountered an error processing your request."
            };
        }

        res.send(parsedResponse);

    } catch (error) {
        console.error("Server error in /api/response:", error);
        res.status(500).send({
            action: "error",
            message: "An internal server error occurred. Please try again later."
        });
    }
};


export const routerResponse = async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).send({ error: "Invalid request: 'prompt' must be a string." });
        }
        const routerPrompt = `
You are an intent classification and response system for a Sui-based assistant.

# INTENT DEFINITIONS:
- "command": The user wants to PERFORM AN ACTION or TRANSACTION (send, receive, swap, check balance, stake, mint, etc.)
- "question": The user is asking for INFORMATION, EXPLANATION, or HELP (what, how, why, when, where, etc.)
- "casual": The user is greeting you, making small talk, or saying something friendly or non-transactional (e.g. "hi", "how are you", "what's up", "gm", "lol", etc.)

# INSTRUCTIONS:
1. Analyze the user's message regardless of language.
2. Focus on the ACTION vs INFORMATION vs CASUAL intent.
3. Ignore grammar, spelling, or language errors.
4. Respond with ONLY valid JSON. No markdown, no extra text.

# OUTPUT RULES:
- If the intent is "command", respond with:
{
  "intent": "command",
}

- If the intent is "question" AND it is related to Sui (e.g. news, updates, price, roadmap, team, etc.), respond with:
{
  "intent": "question",
  "reply": "Sui is a fast, object-based Layer 1 blockchain designed for scalability and user-friendly apps."
}

- If the intent is "question" and NOT related to Sui, respond with:
{
  "intent": "question",
  "reply": "This question is outside my scope. I can only help with Sui-related commands."
}

- If the intent is "casual", respond with:
{
  "intent": "casual",
  "reply": "Hey there! I'm Milo, your Sui assistant. Ready when you are ✨"
}


# USER'S MESSAGE:
"${prompt}"
`;


        const result = await model.generateContent(routerPrompt);
        const response = await result.response;
        const text = response.text().replace(/```json|```/g, '').trim();
        const reply = JSON.parse(text);

        res.send(reply, {
            'Content-Type': 'application/json',
            status: 200
        });

    } catch (error) {
        console.error("Router error in /api/response:", error);
        res.status(500).send({
            action: "error",
            message: "An internal server error occurred in the router. Please try again later."
        });
    }
}