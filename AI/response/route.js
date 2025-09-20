import {validateRequest} from "../lib/utils.js";
import {routeIntent} from "../lib/router.js";
import {handleCommand} from "../lib/commandHandler.js";
import {handleConversation} from "../lib/conversationHandler.js";

export async function POST(request) {
    try {
        const { prompt, contacts } = await request.body;

        validateRequest(prompt);

        const { intent } = await routeIntent(prompt);

        let response;
        switch (intent) {
            case 'command':
                response = await handleCommand(prompt, contacts);
                break;

            case 'question':
            case 'greeting':
                response = await handleConversation(prompt, intent);
                break;

            default:
                throw new Error(`Unknown intent: ${intent}`);
        }

        return Response.json(response);

    } catch (error) {
        console.error("Server error in /api/response:", error);

        // Handle different error types
        if (error.message.includes('Invalid request')) {
            return Response.json(
                { error: error.message },
                { status: 400 }
            );
        }

        return Response.json(
            {
                error: "An internal server error occurred. Please try again later.",
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            },
            { status: 500 }
        );
    }
}
