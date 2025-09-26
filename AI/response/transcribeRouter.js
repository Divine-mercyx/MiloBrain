import {transcribeModel} from "../lib/aiClient.js";

export async function transcribe(request, reply) {
    try {
        const { audio, mimeType, language } = request.body;

        if (!audio || !mimeType) {
            return reply.status(400).send({ error: 'Missing audio or mimeType' });
        }

        const prompt = language
            ? `Transcribe this audio. The spoken language is ${language}.`
            : 'Transcribe this audio.';

        const result = await transcribeModel.generateContent({
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
                            text: prompt,
                        },
                    ],
                },
            ]
        })

        const response = await result.response;
        const transcription = response.text();

        return reply.send({ transcription });

    } catch (error) {
        console.error("Transcription error:", error);
        return reply.status(500).send({ error: 'Failed to transcribe audio' });
    }
}
