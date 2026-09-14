import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.resolve(__dirname, '../workers/embeddingWorker.js');

const worker = new Worker(workerPath);

const pendingTasks = new Map();

worker.on('message', (msg) => {
    const task = pendingTasks.get(msg.id);
    if (!task) return;

    if (msg.type === 'PROGRESS') {
        if (task.onProgress) task.onProgress(msg);
        return;
    }

    if (msg.status === 'SUCCESS') {
        pendingTasks.delete(msg.id);
        task.resolve(msg.data);
    } else if (msg.status === 'ERROR') {
        pendingTasks.delete(msg.id);
        task.reject(new Error(msg.error));
    }
});

worker.on('error', (err) => {
    console.error('[EmbeddingWorker] Fatal thread error:', err);
});

/**
 * Generates an embedding vector for a single string.
 * Used by RAG / Chat retrieval to vectorize incoming user questions.
 * @param {string} text
 * @returns {Promise<number[]>} 768-dimensional float array
 */
export const generateEmbedding = (text) => {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        pendingTasks.set(id, { resolve, reject });
        worker.postMessage({ id, type: 'EMBED_SINGLE', text });
    });
};

/**
 * Generates embeddings for an array of text chunks using the isolated worker thread.
 * Keeps the Express event loop 100% free and responsive during large PDF uploads.
 * 
 * @param {string[]} chunks
 * @param {number} [batchSize=16]
 * @param {Function} [onProgress] - Optional callback receiving { processed, total, percentage }
 * @returns {Promise<Array<{ chunk: string, embedding: number[] }>>}
 */
export const generateBatchEmbeddings = (chunks, batchSize = 16, onProgress = null) => {
    return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        pendingTasks.set(id, { resolve, reject, onProgress });
        worker.postMessage({ id, type: 'EMBED_BATCH', chunks, batchSize });
    });
};

/**
 * Pre-warms the quantized model on server startup inside the worker thread.
 */
export const warmUpEmbeddingModel = () => {
    const id = crypto.randomUUID();
    worker.postMessage({ id, type: 'WARMUP' });
};