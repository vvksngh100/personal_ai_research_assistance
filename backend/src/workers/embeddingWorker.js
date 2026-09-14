import { parentPort } from 'node:worker_threads';
import { pipeline } from '@huggingface/transformers';

let extractor = null;

async function getExtractor() {
    if (!extractor) {
        extractor = await pipeline('feature-extraction', 'Xenova/bge-base-en-v1.5', {
            dtype: 'q8' // 8-bit quantization: reduces RAM to ~125MB
        });
    }
    return extractor;
}

parentPort.on('message', async (message) => {
    const { id, type, text, chunks, batchSize = 16 } = message;

    // Handle startup warm-up
    if (type === 'WARMUP') {
        try {
            await getExtractor();
            parentPort.postMessage({ id, status: 'WARMED' });
        } catch (err) {
            parentPort.postMessage({ id, status: 'ERROR', error: err.message });
        }
        return;
    }

    // Handle single query embedding (used by RAG Chat)
    if (type === 'EMBED_SINGLE') {
        try {
            const pipe = await getExtractor();
            const output = await pipe(text, { pooling: 'mean', normalize: true });
            parentPort.postMessage({ id, status: 'SUCCESS', data: Array.from(output.data) });
        } catch (err) {
            parentPort.postMessage({ id, status: 'ERROR', error: err.message });
        }
        return;
    }

    // Handle batch chunk embeddings (used by PDF Upload)
    if (type === 'EMBED_BATCH') {
        try {
            const pipe = await getExtractor();
            const results = [];

            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                const output = await pipe(batch, { pooling: 'mean', normalize: true });
                const embeddings = output.tolist();

                for (let j = 0; j < batch.length; j++) {
                    results.push({
                        chunk: batch[j],
                        embedding: embeddings[j]
                    });
                }

                // Send live SSE progress update to frontend
                parentPort.postMessage({
                    id,
                    type: 'PROGRESS',
                    processed: results.length,
                    total: chunks.length,
                    percentage: Math.round((results.length / chunks.length) * 100)
                });

                // Short pacing delay so worker doesn't pin 100% CPU continuously
                await new Promise((resolve) => setTimeout(resolve, 50));
            }

            // Signal task completion with the full result set
            parentPort.postMessage({ id, status: 'SUCCESS', data: results });
        } catch (err) {
            parentPort.postMessage({ id, status: 'ERROR', error: err.message });
        }
    }
});