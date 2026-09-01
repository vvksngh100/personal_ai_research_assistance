import { GoogleGenerativeAI } from '@google/generative-ai';
import { configDotenv } from 'dotenv';

configDotenv();

let genAIInstance = null;

/**
 * Returns a singleton instance of GoogleGenerativeAI initialized with GEMINI_API_KEY.
 * Lazy initialization ensures process.env is fully loaded and allows dynamic key resolution.
 */
const getGenAI = () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured in your .env file.');
    }
    if (!genAIInstance) {
        genAIInstance = new GoogleGenerativeAI(apiKey);
    }
    return genAIInstance;
};

const getModelName = () => process.env.GEMINI_MODEL || 'gemini-3.6-flash';

/**
 * Standard non-streaming completion for REST JSON responses.
 * 
 * @param {Object} options
 * @param {string} options.prompt - The formatted user query and context
 * @param {string} [options.systemInstruction] - Grounding guardrails and persona
 * @param {number} [options.temperature] - Generation temperature (default 0.2 for strict factual answers)
 * @returns {Promise<string>}
 */
export const generateCompletion = async ({
    prompt,
    systemInstruction,
    temperature = 0.2
}) => {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
        model: getModelName(),
        systemInstruction,
        generationConfig: {
            temperature,
        }
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
};

/**
 * Streaming completion for real-time Server-Sent Events (SSE).
 * 
 * @param {Object} options
 * @param {string} options.prompt - The formatted user query and context
 * @param {string} [options.systemInstruction] - Grounding guardrails and persona
 * @param {number} [options.temperature] - Generation temperature (default 0.2)
 * @param {function(string): void} options.onChunk - Callback invoked for each token chunk
 * @returns {Promise<string>} The full accumulated response text
 */
export const generateStream = async ({
    prompt,
    systemInstruction,
    temperature = 0.2,
    onChunk
}) => {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({
        model: getModelName(),
        systemInstruction,
        generationConfig: {
            temperature,
        }
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
