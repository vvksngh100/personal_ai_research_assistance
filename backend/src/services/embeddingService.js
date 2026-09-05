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
 * Generates embeddings for an array of text chunks using concurrent mini-batches.
 * Instead of 50 serial iterations, processes 8 chunks concurrently with Promise.all.
 * 
 * @param {string[]} chunks
 * @param {number} [batchSize=8]
 * @returns {Promise<Array<{ chunk: string, embedding: number[] }>>}
 */
export const generateBatchEmbeddings = async (chunks, batchSize = 8) => {
    const results = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const batchPromises = batch.map(async (chunk) => {
            const embedding = await generateEmbedding(chunk);
            return { chunk, embedding };
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    return results;
};

/**
 * Pre-warms the embedding model on server startup to eliminate cold-start latency for the first user.
 */
export const warmUpEmbeddingModel = async () => {
    try {
        console.log('[Embeddings] Pre-warming embedding model...');
        await generateEmbedding('warmup');
        console.log('[Embeddings] Model warmed up and ready in memory.');
    } catch (err) {
        console.warn('[Embeddings] Pre-warm deferred:', err.message);
    }
};
