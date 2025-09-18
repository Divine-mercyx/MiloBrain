import { GoogleGenerativeAI } from "@google/generative-ai";
import NodeCache from 'node-cache';
import dotenv from "dotenv";
import winston from 'winston'; // Added winston import
import * as crypto from "crypto";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("The GOOGLE_API_KEY environment variable is not set.");
}
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// Logging setup
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [new winston.transports.Console()]
});

// Caching setup
const questionCache = new NodeCache({ stdTTL: 300 }); // 5min TTL

// Router prompt (unchanged, for intent classification)
const getRouterPrompt = (prompt) => `
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

// Sui Context Prompt for Questions (correct, for natural language answers)
const getSuiContextPrompt = (prompt) => `
You are Milo, a helpful AI assistant for the Sui blockchain. Answer the user's question based on Sui knowledge.

# SUI CONTEXT:
- Sui is a layer-1 blockchain using Move language, focused on high throughput and low latency.
- Key features: Parallel execution, object-centric model, zkLogin for easy onboarding.
- Common queries: Balances (query via RPC), transfers (use Sui CLI or SDK), swaps (via DEX like Cetus).
- Assets: SUI (native), USDC/USDT (stablecoins), CETUS/WETH (DeFi tokens).

Provide a clear, concise answer. If unclear, ask for clarification.

User's question: "${prompt}"
`;

// Command Prompt for Commands (fixed, for JSON output)
const getCommandPrompt = (prompt, contacts) => `
You are "Milo", an AI assistant that parses natural language commands for the Sui blockchain. Your ONLY task is to convert the user's command into a specific, structured JSON format.

# USER CONTEXT
The user has provided their contact list: ${JSON.stringify(contacts || [])}
If a name is used (e.g., "send to Alex"), you MUST look it up in the contact list and use the associated address. If the name is not found, you must use an "error" action.

# VALIDATION RULES - YOU MUST ENFORCE THESE
1. The only valid assets for the 'transfer' action are: **SUI, USDC, USDT, CETUS, WETH**. If the user specifies any other asset (like 'rubbish', 'doge', 'banana'), the action must be "error".
2. The 'amount' must be a number. ***You MUST convert common number words (e.g., 'one', 'two', 'ten', 'ise', 'iri') into their numerical digit form (e.g., '1', '2', '10', '5', '10') before outputting the JSON.*** If the amount cannot be converted to a number, the action must be "error".
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



export const response = async (req, res) => {
    try {
        // Basic input check (retained for functionality)
        const { prompt, contacts } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            logger.warn('Invalid prompt received', { prompt });
            return res.status(400).send({ error: "Invalid request: 'prompt' must be a string." });
        }

        logger.info('Processing request', { prompt, hasContacts: !!contacts });

        // Step 1: Route - Classify Intent
        const cacheKey = crypto.createHash('md5').update(prompt).digest('hex');
        let intent = questionCache.get(cacheKey); // Cache intent for speed
        if (!intent) {
            const routerResult = await model.generateContent(getRouterPrompt(prompt));
            const routerText = await routerResult.response.text();
            const routerJson = JSON.parse(routerText.replace(/```json|```/g, '').trim());
            intent = routerJson.intent;
            questionCache.set(cacheKey, intent); // Cache intent
            logger.info('Intent classified', { intent, prompt });
        }

        let finalResponse;

        if (intent === 'question') {
            // Handle Question: Generate natural language response from Sui context
            let questionAnswer = questionCache.get(cacheKey + '_answer');
            if (!questionAnswer) {
                const suiResult = await model.generateContent(getSuiContextPrompt(prompt));
                questionAnswer = await suiResult.response.text();
                questionCache.set(cacheKey + '_answer', questionAnswer);
                logger.info('Question answered', { answerLength: questionAnswer.length });
            }
            finalResponse = { type: 'question', answer: questionAnswer };
        } else {
            // Handle Command: Original JSON logic
            const commandResult = await model.generateContent(getCommandPrompt(prompt, contacts));
            const commandText = await commandResult.response.text();
            logger.info('Command AI response', { rawCommandText: commandText });

            try {
                const jsonString = commandText.replace(/```json|```/g, '').trim();
                finalResponse = JSON.parse(jsonString);
            } catch (parseError) {
                logger.error('Command JSON parse error', { error: parseError.message, rawText: commandText });
                finalResponse = {
                    action: "error",
                    message: "Sorry, I encountered an error processing your request."
                };
            }
        }

        return res.send(finalResponse); // Use json() for proper headers
    } catch (error) {
        logger.error('Server error in /api/response', { error: error.message, stack: error.stack });
        return res.status(500).send({
            action: "error",
            message: "An internal server error occurred. Please try again later."
        });
    }
};

// Updated routerResponse (simplified, kept for compatibility)
export const routerResponse = async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt || typeof prompt !== 'string') {
            logger.warn('Invalid prompt in router', { prompt });
            return res.status(400).send({ error: "Invalid request: 'prompt' must be a string." });
        }

        const cacheKey = require('crypto').createHash('md5').update(prompt).digest('hex');
        let intent = questionCache.get(cacheKey);
        if (!intent) {
            const routerPrompt = getRouterPrompt(prompt);
            const result = await model.generateContent(routerPrompt);
            const response = await result.response;
            const text = response.text().replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(text);
            intent = parsed.intent;
            questionCache.set(cacheKey, intent);
            logger.info('Router intent classified', { intent, prompt });
        }

        return res.json({ intent }); // Use json() for consistency
    } catch (error) {
        logger.error('Router error in /api/response', { error: error.message });
        return res.status(500).send({
            intent: "error",
            message: "An internal server error occurred in the router. Please try again later."
        });
    }
};