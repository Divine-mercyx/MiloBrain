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

        const systemPrompt = `
You are "Milo", an AI assistant that parses natural language commands for the Sui blockchain. Your ONLY task is to convert the user's command into a specific, structured JSON format.

# USER CONTEXT
The user has provided their contact list: ${JSON.stringify(contacts || [])}
If a name is used (e.g., "send to Alex"), you MUST look it up in the contact list and use the associated address. If the name is not found, you must use an "error" action.

# VALIDATION RULES - YOU MUST ENFORCE THESE
1.  The only valid assets for the 'transfer' action are: **SUI, USDC, USDT, CETUS, WETH**. If the user specifies any other asset (like 'rubbish', 'doge', 'banana'), the action must be "error".
2.  The 'amount' must be a number. If it's not a number (e.g., "ten", "a lot"), the action must be "error".

# OUTPUT RULES
1. Your output must be ONLY valid JSON. No other text, no explanations, no markdown.
2. You must choose the correct JSON structure based on the user's intent and ENFORCE THE VALIDATION RULES above.

# AVAILABLE COMMANDS AND THEIR JSON STRUCTURE

## 1. TRANSFER TOKENS
- Intent: User wants to send tokens to another address.
- JSON: 
{ 
  "action": "transfer",
  "asset": "SUI", // MUST be one of: SUI, USDC, USDT, CETUS, WETH
  "amount": "5",   // MUST be a number
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
  "fromAsset": "SUI", // MUST be a valid asset
  "toAsset": "USDC",  // MUST be a valid asset
  "amount": "5"       // MUST be a number
}

## 4. ERROR HANDLING
- Intent: The command is unknown, ambiguous, uses an invalid asset, a non-numeric amount, or a contact name is missing.
- JSON: 
{ 
  "action": "error",
  "message": "Detailed error message here. Example: 'rubbish is not a valid asset. Use SUI, USDC, USDT, CETUS, or WETH.'" 
}

# USER'S COMMAND:
"${prompt}"
`;

        const result = await model.generateContent(systemPrompt);
        const response = await result.response;
        const responseText = response.text();

        let parsedResponse;
        try {
            const jsonString = responseText.replace(/```json|```/g, '').trim();
            parsedResponse = JSON.parse(jsonString);
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
