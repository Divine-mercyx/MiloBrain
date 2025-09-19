import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("The GOOGLE_API_KEY environment variable is not set.");
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

export const response = async (req, res) => {
    try {
        const { prompt, contacts } = req.body;

        if (!prompt || typeof prompt !== 'string') {
            return res.status(400).send({ error: "Invalid request: 'prompt' must be a string." });
        }

        // First, classify the intent
        const routerPrompt = `
You are an intent classification system for a Sui blockchain assistant. Analyze the user's message and determine if it is a COMMAND, QUESTION, or GREETING.

# INTENT DEFINITIONS:
- "command": The user wants to PERFORM A SUI BLOCKCHAIN ACTION or TRANSACTION (send, transfer, swap, exchange, check balance, view portfolio, stake, mint, burn, etc.)
  Examples: "send 5 SUI to Alex", "swap 10 USDC for USDT", "check my balance"
- "question": The user is asking for INFORMATION, EXPLANATION, or HELP about SUI blockchain, crypto, or general knowledge
  Examples: "what is sui", "how does sui work", "what are smart contracts", "explain DeFi"
- "greeting": The user is making a casual greeting or conversation
  Examples: "hello", "hi there", "how are you", "good morning", "thanks"

# INSTRUCTIONS:
1. Analyze the user's message regardless of language
2. Focus on the ACTION vs INFORMATION vs SOCIAL intent
3. For blockchain-related questions, classify as "question" even if they contain action words
4. Ignore grammar, spelling, or language errors
5. Respond with ONLY valid JSON: { "intent": "command" | "question" | "greeting" }

User's message: "${prompt}"
`;

        const routerResult = await model.generateContent(routerPrompt);
        const routerResponse = await routerResult.response;
        const routerText = routerResponse.text().replace(/```json|```/g, '').trim();
        const { intent } = JSON.parse(routerText);

        // Handle based on intent
        if (intent === "command") {
            // Process as blockchain command
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
  "action": "transfer",
  "asset": "SUI",
  "amount": "5",
  "recipient": "0x..."
}

## 2. VIEW BALANCE (Query)
- Intent: User asks about their portfolio or balance.
- JSON: 
{ 
  "action": "query_balance"
}

## 3. SWAP TOKENS
- Intent: User wants to exchange one token for another.
- JSON: 
{ 
  "action": "swap",
  "fromAsset": "SUI",
  "toAsset": "USDC",
  "amount": "5"
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

            const commandResult = await model.generateContent(systemPrompt);
            const commandResponse = await commandResult.response;
            const commandText = commandResponse.text();

            let parsedResponse;
            try {
                const jsonString = commandText.replace(/```json|```/g, '').trim();
                parsedResponse = JSON.parse(jsonString);
            } catch (parseError) {
                console.error("AI Command Response was not valid JSON:", commandText);
                parsedResponse = {
                    action: "error",
                    message: "Sorry, I encountered an error processing your command."
                };
            }

            res.send(parsedResponse);

        } else if (intent === "question" || intent === "greeting") {
            // Handle questions about SUI or casual greetings
            const conversationalPrompt = `
You are Milo, a helpful AI assistant specializing in the Sui blockchain. You respond to questions about SUI, blockchain technology, and crypto in a clear, friendly, and informative way. For greetings, respond warmly and engagingly.

# CONTEXT:
- Focus on being helpful and educational about Sui blockchain
- Keep responses concise but informative (1-2 paragraphs max)
- Use simple language that anyone can understand
- If the user asks about technical topics, explain them in plain English
- For greetings, be friendly and invite further conversation about Sui

# USER'S MESSAGE:
"${prompt}"

Please provide a helpful response. If it's a greeting, respond warmly. If it's a question about Sui or blockchain, provide a clear explanation.
`;

            const convoResult = await model.generateContent(conversationalPrompt);
            const convoResponse = await convoResult.response;
            const responseText = convoResponse.text();

            // Wrap conversational responses in a consistent format
            const conversationalResponse = {
                type: "conversational",
                intent: intent,
                message: responseText.trim()
            };

            res.send(conversationalResponse);

        } else {
            // Fallback for unrecognized intent
            res.status(400).send({
                type: "error",
                message: "I didn't understand your request. I can help with Sui blockchain transactions, answer questions about crypto, or just chat! Try asking about transfers, swaps, balances, or what Sui is."
            });
        }

    } catch (error) {
        console.error("Server error in /api/response:", error);
        res.status(500).send({
            type: "error",
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
You are an intent classification system. Analyze the user's message and determine if it is a COMMAND or a QUESTION.

# INTENT DEFINITIONS:
- "command": The user wants to PERFORM AN ACTION or TRANSACTION (send, receive, swap, check balance, stake, mint, etc.)
- "question": The user is asking for INFORMATION, EXPLANATION, or HELP (what, how, why, when, where, etc.)

# INSTRUCTIONS:
1. Analyze the user's message regardless of language
2. Focus on the ACTION vs INFORMATION intent
3. Ignore grammar, spelling, or language errors
4. Respond with ONLY valid JSON: { "intent": "command" | "question" }

User's message: "${prompt}"
`;
        const result = await model.generateContent(routerPrompt);
        const response = await result.response;
        const text = response.text().replace(/```json|```/g, '').trim();
        const { intent } = JSON.parse(text);

        res.json({ intent });

    } catch (error) {
        console.error("Router error in /api/response:", error);
        res.status(500).json({
            error: "An internal server error occurred in the router. Please try again later."
        });
    }
};