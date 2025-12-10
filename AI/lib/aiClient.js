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

// Determine which provider to use based on available API keys
let provider = 'gemini'; // default
let models = null;

if (anthropicApiKey) {
    // Use Claude if Anthropic API key is available
    provider = 'claude';
    const anthropic = new Anthropic({
        apiKey: anthropicApiKey
    });
    
    models = {
        routerModel: {
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
        },
        commandModel: {
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
        },
        transcribeModel: {
            generateContent: async (prompt) => {
                let actualPrompt = prompt;
                if (typeof prompt === 'object' && prompt.contents) {
                    // Handle Gemini-style prompts
                    if (prompt.contents[0].parts) {
                        const inlineData = prompt.contents[0].parts.find(part => part.inlineData);
                        const textPart = prompt.contents[0].parts.find(part => part.text);
                        actualPrompt = textPart?.text || '';
                    }
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
        }
    };
} else if (geminiApiKeys.length > 0) {
    // Use Gemini with API key rotation
    provider = 'gemini';
    
    // Create a wrapper that handles API key rotation
    const createGeminiModelWithRotation = (modelType) => {
        return {
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
                        const model = genAI.getGenerativeModel({ model: modelType });
                        return await model.generateContent(prompt);
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
    };
    
    models = {
        routerModel: createGeminiModelWithRotation("gemini-2.5-flash"),
        commandModel: createGeminiModelWithRotation("gemini-2.5-flash"),
        transcribeModel: createGeminiModelWithRotation("gemini-2.5-flash")
    };
    
    console.log(`Initialized Gemini with ${geminiApiKeys.length} API keys`);
} else {
    throw new Error("Either GEMINI_API_KEYS or ANTHROPIC_API_KEY environment variable must be set.");
}

console.log(`AI Provider initialized: ${provider}`);

// Export configured models and provider info
export const { routerModel, commandModel, transcribeModel } = models;
export const aiProvider = provider;