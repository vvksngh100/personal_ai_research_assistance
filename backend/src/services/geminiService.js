import Groq from 'groq-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { configDotenv } from 'dotenv';

configDotenv();

let groqInstance = null;
let genAIInstance = null;

const getGroq = () => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return null;
    if (!groqInstance) {
        groqInstance = new Groq({ apiKey });
    }
    return groqInstance;
};

const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return null;
    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(apiKey);
    }
    return genAIInstance;
};

/**
 * Standard non-streaming completion for REST JSON responses.
 */
export const generateCompletion = async ({
    prompt,
    systemInstruction,
    temperature = 0.2
}) => {
    const groq = getGroq();
    if (groq) {
        const messages = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }
        messages.push({ role: 'user', content: prompt });

        const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
        const response = await groq.chat.completions.create({
            model,
            messages,
            temperature
        });

        return response.choices[0]?.message?.content || '';
    }

    const genAI = getGenAI();
    if (!genAI) {
        throw new Error('Neither GROQ_API_KEY nor GEMINI_API_KEY is configured in your .env file.');
    }
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: { temperature }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
};

/**
 * Streaming completion for real-time Server-Sent Events (SSE).
 */
export const generateStream = async ({
    prompt,
    systemInstruction,
    temperature = 0.2,
    onChunk
}) => {
    const groq = getGroq();
    if (groq) {
        const messages = [];
        if (systemInstruction) {
            messages.push({ role: 'system', content: systemInstruction });
        }
        messages.push({ role: 'user', content: prompt });

        const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
        const stream = await groq.chat.completions.create({
            model,
            messages,
            temperature,
            stream: true
        });

        let fullText = '';
        for await (const chunk of stream) {
            const token = chunk.choices[0]?.delta?.content || '';
            if (token) {
                fullText += token;
                if (onChunk) {
                    onChunk(token);
                }
            }
        }
        return fullText;
    }

    const genAI = getGenAI();
    if (!genAI) {
        throw new Error('Neither GROQ_API_KEY nor GEMINI_API_KEY is configured in your .env file.');
    }
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction,
        generationConfig: { temperature }
    });

    const result = await model.generateContentStream(prompt);
    let fullText = '';
    for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
            fullText += chunkText;
            if (onChunk) {
                onChunk(chunkText);
            }
        }
    }
    return fullText;
};
