import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.resolve(__dirname, '../workers/pdfWorker.js');

let pdfWorker = null;
const pendingTasks = new Map();

function getWorker() {
    if (!pdfWorker) {
        pdfWorker = new Worker(workerPath);

        pdfWorker.on('message', (msg) => {
            const task = pendingTasks.get(msg.id);
            if (!task) return;

            pendingTasks.delete(msg.id);
            if (msg.status === 'SUCCESS') {
                task.resolve(msg);
            } else {
                task.reject(new Error(msg.error || 'Failed to parse PDF'));
            }
        });

        pdfWorker.on('error', (err) => {
            console.error('[PDFWorker] Thread fatal error:', err);
            // Reject any waiting tasks if thread dies
            for (const [id, task] of pendingTasks.entries()) {
                task.reject(err);
                pendingTasks.delete(id);
            }
            pdfWorker = null; // Recreate on next call
        });

        pdfWorker.on('exit', (code) => {
            if (code !== 0) {
                console.warn(`[PDFWorker] Worker exited with code ${code}`);
            }
            pdfWorker = null;
        });
    }
    return pdfWorker;
}

/**
 * Extracts text and chunks from a PDF buffer in a separate Worker Thread.
 * Uses Zero-Copy Transferable ArrayBuffers to prevent memory duplication on large files.
 * 
 * @param {Buffer} buffer - Multer file buffer
 * @param {number} [maxChunkSize=1000]
 * @param {number} [overlap=100]
 * @returns {Promise<{ totalPages: number, textLength: number, chunks: string[], text: string }>}
 */
export const parsePdfInWorker = (buffer, maxChunkSize = 1000, overlap = 100) => {
    return new Promise((resolve, reject) => {
        try {
            const worker = getWorker();
            const id = crypto.randomUUID();

            pendingTasks.set(id, { resolve, reject });

            if (Buffer.isBuffer(buffer)) {
                // Zero-copy transfer: transfer ownership of the underlying ArrayBuffer slice
                const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
                worker.postMessage({ id, buffer: arrayBuffer, maxChunkSize, overlap }, [arrayBuffer]);
            } else {
                worker.postMessage({ id, buffer, maxChunkSize, overlap });
            }
        } catch (err) {
            reject(err);
        }
    });
};
