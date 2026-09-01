import { getPineconeIndex } from '../config/pinecone.js';
import { generateEmbedding } from './embeddingService.js';

const SYSTEM_GROUNDING_INSTRUCTION = `You are a rigorous, highly capable AI Research Assistant.
Your task is to answer the user's question accurately and objectively based solely on the provided Context excerpts from the user's research document.

CRITICAL GROUNDING RULES:
1. Rely ONLY on the facts directly stated in the Context below. Do not extrapolate, speculate, or bring in external knowledge not present in the text.
2. If the Context does not contain enough information to answer the question, or if no relevant context was found, explicitly state:
   "Based on the provided document, I cannot find sufficient information to answer this question."
3. CITATIONS: Attribute your statements by referencing the source numbers in square brackets (e.g., [1], [2]). Every key factual assertion should cite the source where it appears.
4. Maintain a clear, professional, and structured tone. Use bullet points or numbered steps where appropriate for readability.`;

/**
 * Retrieves the most semantically relevant text chunks from Pinecone.
 * 
 * @param {string} documentId - The document UUID
 * @param {string} query - The user query to search against
 * @param {Object} [options]
 * @param {number} [options.topK=4] - Max number of chunks to retrieve
 * @param {number} [options.scoreThreshold=0.55] - Minimum cosine similarity threshold
 * @returns {Promise<Array<{ id: string, score: number, chunk_index: number, text: string, document_id: string }>>}
 */
export const retrieveContext = async (
    documentId,
    query,
    { topK = 4, scoreThreshold = 0.55 } = {}
) => {
    try {
        const namespace = `doc_${documentId}`;
        const index = getPineconeIndex();

        // 1. Generate 768-dim query embedding using the same model as ingestion
        const queryVector = await generateEmbedding(query);

        // 2. Query Pinecone scoped strictly to the document namespace
        const queryResponse = await index.namespace(namespace).query({
            vector: queryVector,
            topK,
            includeMetadata: true,
        });

        const matches = queryResponse.matches || [];

        // 3. Filter by similarity threshold to avoid feeding low-relevance noise
        const filteredMatches = matches
            .filter(match => typeof match.score === 'number' && match.score >= scoreThreshold)
            .map((match, index) => ({
                source_id: index + 1,
                vector_id: match.id,
                score: match.score,
                chunk_index: match.metadata?.chunk_index ?? 0,
                text: match.metadata?.text || '',
                document_id: match.metadata?.document_id || documentId,
            }));

        console.log(`[RAG] Retrieved ${matches.length} matches from Pinecone (${filteredMatches.length} passed score threshold >= ${scoreThreshold})`);

        return filteredMatches;
    } catch (error) {
        console.error('[RAG] Error retrieving context from Pinecone:', error);
        throw new Error(`Failed to retrieve document context: ${error.message}`);
    }
};

/**
 * Assembles the grounded prompt containing retrieved contexts and recent conversation history.
 * 
 * @param {string} query - The user's prompt
 * @param {Array<Object>} retrievedChunks - Chunks passing the similarity threshold
 * @param {Array<{ role: string, content: string }>} [conversationHistory=[]] - Recent conversation turns
 * @returns {{ systemInstruction: string, prompt: string }}
 */
export const buildGroundedPrompt = (
    query,
    retrievedChunks = [],
    conversationHistory = []
) => {
    let contextBlock = '';
    if (retrievedChunks.length === 0) {
        contextBlock = '[No document excerpts exceeded the relevance threshold for this query.]';
    } else {
        contextBlock = retrievedChunks
            .map(chunk => `[Source ${chunk.source_id}] (Excerpt index ${chunk.chunk_index}, Relevance: ${(chunk.score * 100).toFixed(1)}%):\n${chunk.text}`)
            .join('\n\n');
    }

    let historyBlock = '';
    if (conversationHistory.length > 0) {
        historyBlock = 'PREVIOUS CONVERSATION TURNS:\n' + conversationHistory
            .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
            .join('\n') + '\n\n';
    }

    const prompt = `DOCUMENT CONTEXT EXCERPTS:
${contextBlock}

${historyBlock}USER QUESTION:
${query}

Provide a grounded, well-cited response following the rules provided.`;

    return {
        systemInstruction: SYSTEM_GROUNDING_INSTRUCTION,
        prompt,
    };
};
