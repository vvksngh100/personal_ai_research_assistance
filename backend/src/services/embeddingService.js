import { pipeline } from '@xenova/transformers';

class EmbeddingPipeline {
    static instance = null;

    static async getInstance() {
        if (!this.instance) {
            // Loads feature-extraction pipeline using a 768-dimension model to match Pinecone
            this.instance = await pipeline('feature-extraction', 'Xenova/bge-base-en-v1.5');
        }
        return this.instance;
    }
}

/**
 * Generates an embedding vector for a single string.
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimensional float array
 */
export const generateEmbedding = async (text) => {
    const extractor = await EmbeddingPipeline.getInstance();
    
    // pooling: 'mean', normalize: true are standard for cosine similarity
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    
    return Array.from(output.data);
};

/**
 * Generates embeddings for an array of text chunks.
 * @param {string[]} chunks
 * @returns {Promise<Array<{ chunk: string, embedding: number[] }>>}
 */
export const generateBatchEmbeddings = async (chunks) => {
    const results = [];
    for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk);
        results.push({ chunk, embedding });
    }
    return results;
};