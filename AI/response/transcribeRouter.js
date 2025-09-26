import { transcribeModel } from "../lib/aiClient.js";

export async function transcribe(request, reply) {
    try {
        const { audio, mimeType, language } = request.body;

        if (!audio || !mimeType) {
            return reply.status(400).send({ error: 'Missing audio or mimeType' });
        }

        try {
            Buffer.from(audio, 'base64');
        } catch {
            return reply.status(400).send({ error: 'Invalid base64 audio data' });
        }

        const initialResult = await transcribeModel.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [
                        {
                            inlineData: {
                                mimeType,
                                data: audio,
                            },
                        },
                        {
                            text: `Transcribe this audio accurately. in this language ${language}`,
                        },
                    ],
                },
            ]
        });

        const initialResponse = await initialResult.response;
        let transcription = (await initialResponse.text()).trim();

        const refinementPrompt = `
You are a blockchain assistant helping correct voice transcriptions. 
The user is likely talking about cryptocurrency transactions.

Original transcription: "${transcription}"

Please correct any misheard cryptocurrency terms and apply blockchain context:

CRYPTO CORRECTIONS:
- "sweet", "swit", "suite" → "SUI"
- "you ess dee see" → "USDC" 
- "bit coin" → "Bitcoin"
- "etherium" → "Ethereum"

TRANSACTION CONTEXT:
- If it sounds like a transaction command, ensure numbers and crypto names are correct
- "send five sweet" → "send 5 SUI"
- "swap ten suite" → "swap 10 SUI"

Keep the original language and intent, but fix cryptocurrency terminology.

Corrected transcription:
`;

        const refinementResult = await transcribeModel.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [{ text: refinementPrompt }],
                },
            ]
        });

        const refinementResponse = await refinementResult.response;
        transcription = (await refinementResponse.text()).trim();

        transcription = transcription.replace(/^Corrected transcription:\s*/i, '');

        return reply.send({ transcription });

    } catch (error) {
        console.error("Transcription error:", error);
        return reply.status(500).send({ error: 'Failed to transcribe audio' });
    }
}
