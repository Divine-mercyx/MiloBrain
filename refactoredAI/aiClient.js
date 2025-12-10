// Frontend-compatible AI client supporting both Google Generative AI and Anthropic Claude
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";

// Track current API key index for rotation
let currentGeminiKeyIndex = 0;

// Function to rotate to next Gemini API key
function rotateGeminiKey(geminiApiKeys) {
    if (geminiApiKeys.length > 1) {
        currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % geminiApiKeys.length;
        console.log(`Rotating to Gemini API key ${currentGeminiKeyIndex + 1}/${geminiApiKeys.length}`);
        return true;
    }
    return false;
}

/**
 * Initialize AI models with the provided API key
 * @param {string} apiKey - API key for the selected provider
 * @param {string} provider - AI provider ('gemini' or 'claude')
 */
export function initializeAI(apiKey, provider = 'gemini') {
    if (!apiKey) {
        throw new Error("API key is required to initialize AI models");
    }
    
    if (provider === 'claude') {
        // Initialize Anthropic Claude
        const anthropic = new Anthropic({
            apiKey: apiKey
        });
        
        // Return Claude models
        return {
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
            },
            conversationModel: {
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
            }
        };
    } else {
        // Default to Google Generative AI (Gemini) with API key rotation support
        const geminiApiKeys = apiKey.includes(',') ? apiKey.split(',') : [apiKey];
        currentGeminiKeyIndex = 0; // Reset index
        
        // Create a wrapper that handles API key rotation
        const createGeminiModelWithRotation = (modelType) => {
            return {
                generateContent: async (prompt) => {
                    let lastError;
                    let attempts = 0;
                    const maxAttempts = geminiApiKeys.length || 1;
                    
                    while (attempts < maxAttempts) {
                        try {
                            const currentKey = geminiApiKeys[currentGeminiKeyIndex];
                            if (!currentKey) {
                                throw new Error("No valid Gemini API key available");
                            }
                            
                            const genAI = new GoogleGenerativeAI(currentKey.trim());
                            const model = genAI.getGenerativeModel({ model: modelType });
                            return await model.generateContent(prompt);
                        } catch (error) {
                            lastError = error;
                            console.error(`Gemini API key ${currentGeminiKeyIndex + 1} failed:`, error.message);
                            
                            // If it's an authentication error, rotate to the next key
                            if (error.message.includes('API_KEY_INVALID') || error.message.includes('401')) {
                                if (rotateGeminiKey(geminiApiKeys)) {
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
        
        // Export configured models
        return {
            routerModel: createGeminiModelWithRotation("gemini-2.5-flash"),
            commandModel: createGeminiModelWithRotation("gemini-2.5-flash"),
            transcribeModel: createGeminiModelWithRotation("gemini-2.5-flash"),
            conversationModel: createGeminiModelWithRotation("gemini-2.5-flash")
        };
    }
}

/**
 * Parse AI response text to extract JSON
 * @param {string} text - Raw AI response text
 * @returns {Object} Parsed JSON object
 */
export function parseGeminiResponse(text) {
    try {
        const jsonString = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", text);
        throw new Error("AI generated an invalid response.");
    }
}

/**
 * Parse Claude response text to extract JSON
 * @param {string} text - Raw AI response text
 * @returns {Object} Parsed JSON object
 */
export function parseClaudeResponse(text) {
    try {
        const jsonString = text.replace(/```json|```/g, '').trim();
        return JSON.parse(jsonString);
    } catch (parseError) {
        console.error("Failed to parse AI response as JSON:", text);
        throw new Error("AI generated an invalid response.");
    }
}