import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { getPineconeIndex } from '../config/pinecone.js';
import { parsePdfInWorker } from '../services/pdfService.js';
import { generateBatchEmbeddings } from '../services/embeddingService.js';
import { uploadQueue } from '../utils/uploadQueue.js';

// Global Event Emitter and in-memory progress cache for SSE
const uploadProgressEmitter = new EventEmitter();
uploadProgressEmitter.setMaxListeners(200);

const progressCache = new Map();

/**
 * Background worker to compute embeddings and upsert to Pinecone.
 * Emits progress percentage via uploadProgressEmitter.
 */
async function processDocumentInBackground(documentId, namespace, chunks, fileName) {
    const emitProgress = (data) => {
        progressCache.set(documentId, data);
        uploadProgressEmitter.emit(`progress:${documentId}`, data);
    };

    try {
        console.log(`[Upload] Background: Processing ${chunks.length} chunk(s) for "${fileName}"...`);
        emitProgress({
            status: 'processing',
            stage: 'embedding',
            percentage: 5,
            processed: 0,
            total: chunks.length,
            message: `Starting embedding generation for ${chunks.length} chunks...`
        });

        // Generate embeddings in balanced batches of 24 with live progress updates (5% -> 85%)
        const embeddedChunks = await generateBatchEmbeddings(chunks, 24, ({ processed, total }) => {
            const embeddingPct = 5 + Math.round((processed / total) * 80);
            console.log(`[Upload] Embedding progress: ${processed}/${total} chunks (${embeddingPct}%)`);
            emitProgress({
                status: 'processing',
                stage: 'embedding',
                percentage: embeddingPct,
                processed,
                total,
                message: `Generated embeddings: ${processed}/${total} chunks (${embeddingPct}%)`
            });
        });

        // Format vectors for Pinecone
        const vectors = embeddedChunks.map((item, index) => ({
            id: `${documentId}_chunk_${index}`,
            values: item.embedding,
            metadata: {
                document_id: documentId,
                chunk_index: index,
                text: item.chunk
            }
        }));

        if (!vectors || vectors.length === 0) {
            throw new Error('No vector embeddings generated for document');
        }

        // Upsert to Pinecone in batches of 100 (85% -> 98%)
        console.log(`[Upload] Background: Upserting ${vectors.length} vector(s) to Pinecone namespace: ${namespace}...`);
        const index = getPineconeIndex();
        const PINECONE_BATCH_SIZE = 100;
        const totalBatches = Math.ceil(vectors.length / PINECONE_BATCH_SIZE);

        for (let i = 0; i < vectors.length; i += PINECONE_BATCH_SIZE) {
            const batch = vectors.slice(i, i + PINECONE_BATCH_SIZE);
            await index.namespace(namespace).upsert({ records: batch });

            const currentBatch = Math.floor(i / PINECONE_BATCH_SIZE) + 1;
            const upsertPct = 85 + Math.round((currentBatch / totalBatches) * 13);
            emitProgress({
                status: 'processing',
                stage: 'indexing',
                percentage: upsertPct,
                processed: Math.min(i + PINECONE_BATCH_SIZE, vectors.length),
                total: vectors.length,
                message: `Uploaded batch ${currentBatch}/${totalBatches} to vector store`
            });
        }

        // Mark document as ready in PostgreSQL
        await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['ready', documentId]);
        console.log(`[Upload] Document "${fileName}" (${documentId}) successfully vectorized and marked ready.`);

        // Final ready notification
        emitProgress({
            status: 'ready',
            stage: 'completed',
            percentage: 100,
            chunks_processed: vectors.length,
            message: 'Document processed and vectorized successfully'
        });

        // Clean cache entry after 5 minutes
        setTimeout(() => {
            progressCache.delete(documentId);
        }, 5 * 60 * 1000);

    } catch (err) {
        console.error(`[Upload] Background processing failed for "${fileName}" (${documentId}):`, err);
        try {
            await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['failed', documentId]);
        } catch (dbErr) {
            console.error('Failed to set document status to failed in DB:', dbErr.message);
        }

        emitProgress({
            status: 'failed',
            stage: 'error',
            percentage: 0,
            error: err.message || 'Failed to process and vectorize document'
        });

        setTimeout(() => {
            progressCache.delete(documentId);
        }, 5 * 60 * 1000);
    }
}

export const uploadDocument = async (req, res) => {
    let documentId = null;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        const userId = req.user ? req.user.id : null;
        const guestId = req.guest ? req.guest.guest_id : null;

        if (!userId && !guestId) {
            return res.status(401).json({ error: 'Unauthorized: missing user or guest identity' });
        }

        documentId = uuidv4();
        const namespace = `doc_${documentId}`;
        const fileName = req.file.originalname;
        const fileSize = req.file.size;

        // Initial DB record creation
        const insertDocQuery = `
            INSERT INTO documents (id, user_id, guest_id, file_name, file_path, file_size_bytes, mime_type, status, pinecone_namespace)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing', $8)
            RETURNING *;
        `;
        const insertResult = await pool.query(insertDocQuery, [
            documentId,
            userId,
            guestId,
            fileName,
            'memory_storage',
            fileSize,
            req.file.mimetype,
            namespace
        ]);

        // Create initial research chat session for the uploaded document immediately
        const sessionId = uuidv4();
        await pool.query(
            `INSERT INTO chat_sessions (id, user_id, guest_id, document_id, title)
             VALUES ($1, $2, $3, $4, $5)`,
            [sessionId, userId, guestId, documentId, fileName]
        );

        // Extract text & create chunks on isolated Worker Thread (zero event-loop blocking)
        const { chunks, textLength, totalPages } = await parsePdfInWorker(req.file.buffer);

        if (!textLength || textLength === 0) {
            console.warn(`[Upload] PDF "${fileName}" (${totalPages} pages) contained 0 extractable text characters.`);
            await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['failed', documentId]);
            return res.status(400).json({
                error: 'No text could be extracted from this PDF. It may be an image-only scan, blank, or password-protected.'
            });
        }

        console.log(`[Upload] Worker generated ${chunks.length} chunks across ${totalPages} pages for "${fileName}"`);

        if (!chunks || chunks.length === 0) {
            console.warn(`[Upload] Chunking produced 0 chunks for "${fileName}".`);
            await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['failed', documentId]);
            return res.status(400).json({
                error: 'Failed to create text chunks from the document.'
            });
        }

        // Return HTTP 202 Accepted immediately so client never times out
        res.status(202).json({
            message: 'Document uploaded successfully. Background processing started.',
            document_id: documentId,
            session_id: sessionId,
            status: 'processing',
            total_chunks: chunks.length,
            document: insertResult.rows[0]
        });

        // Helper to notify clients via SSE while in queue or during execution
        const emitProgress = (data) => {
            progressCache.set(documentId, data);
            uploadProgressEmitter.emit(`progress:${documentId}`, data);
        };

        // Enqueue document processing task into the dual-lane concurrency queue (Fast Lane vs Standard Lane)
        uploadQueue.enqueue({
            documentId,
            chunksCount: chunks.length,
            emitProgress,
            execute: () => processDocumentInBackground(documentId, namespace, chunks, fileName)
        });

    } catch (error) {
        console.error('Upload processing error:', error);
        if (documentId) {
            try {
                await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['failed', documentId]);
            } catch (dbErr) {
                console.error('Failed to set document status to failed:', dbErr.message);
            }
        }
        return res.status(500).json({ error: 'Failed to upload and initiate document processing' });
    }
};

/**
 * Server-Sent Events (SSE) endpoint to stream real-time document progress and percentage.
 * Route: GET /api/upload/progress/:id
 */
export const streamDocumentProgress = async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user?.id || null;
        const guestId = req.guest?.id || req.guest?.guest_id || null;

        // 1. Send SSE headers immediately so reverse proxies never time out (Eliminates 504 Gateway Timeout)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        // Send 2KB initial comment padding to bypass proxy buffers (Vite, Nginx, etc.)
        res.write(`: ${' '.repeat(2048)}\n\n`);
        if (typeof res.flush === 'function') res.flush();

        // 2. Check in-memory cache first (instant, 0ms latency)
        const cached = progressCache.get(documentId);
        if (cached) {
            res.write(`data: ${JSON.stringify(cached)}\n\n`);
            if (typeof res.flush === 'function') res.flush();

            if (cached.status === 'ready' || cached.status === 'failed') {
                setTimeout(() => { try { res.end(); } catch {} }, 1000);
                return;
            }
        } else {
            // Initial connecting state
            res.write(`data: ${JSON.stringify({ status: 'processing', stage: 'embedding', percentage: 5, message: 'Processing document...' })}\n\n`);
            if (typeof res.flush === 'function') res.flush();
        }

        // 3. Register real-time progress listener
        const eventName = `progress:${documentId}`;
        const onProgress = (data) => {
            try {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
                if (typeof res.flush === 'function') res.flush();

                if (data.status === 'ready' || data.status === 'failed') {
                    cleanup();
                    setTimeout(() => {
                        try { res.end(); } catch {}
                    }, 1500);
                }
            } catch (writeErr) {
                cleanup();
            }
        };

        uploadProgressEmitter.on(eventName, onProgress);

        // Keep-alive heartbeat ping every 8s to keep proxy connections active
        const keepAliveTimer = setInterval(() => {
            try {
                res.write(': keep-alive\n\n');
                if (typeof res.flush === 'function') res.flush();
            } catch {
                cleanup();
            }
        }, 8000);

        const cleanup = () => {
            uploadProgressEmitter.off(eventName, onProgress);
            clearInterval(keepAliveTimer);
        };

        req.on('close', cleanup);

        // 4. Asynchronously verify document in DB only if not found in active in-memory cache
        if (!cached) {
            pool.query(
                `SELECT id, status FROM documents WHERE id = $1 AND (($2::uuid IS NOT NULL AND user_id = $2::uuid) OR ($3::uuid IS NOT NULL AND guest_id = $3::uuid))`,
                [documentId, userId, guestId]
            ).then((docResult) => {
                if (docResult.rows.length === 0) {
                    res.write(`data: ${JSON.stringify({ status: 'failed', error: 'Document not found or access denied' })}\n\n`);
                    cleanup();
                    setTimeout(() => { try { res.end(); } catch {} }, 1000);
                } else if (docResult.rows[0].status === 'ready') {
                    res.write(`data: ${JSON.stringify({ status: 'ready', stage: 'completed', percentage: 100, message: 'Document is ready' })}\n\n`);
                    cleanup();
                    setTimeout(() => { try { res.end(); } catch {} }, 1000);
                }
            }).catch((err) => {
                console.warn('[SSE DB Check Warning]:', err.message);
            });
        }

    } catch (err) {
        console.error('[SSE Progress Error]:', err);
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to establish progress stream' });
        }
        res.end();
    }
};

/**
 * Status endpoint to poll real-time document progress and percentage.
 * Route: GET /api/upload/status/:id
 */
export const getDocumentStatus = async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user?.id || null;
        const guestId = req.guest?.id || req.guest?.guest_id || null;

        const docResult = await pool.query(
            `SELECT id, status, file_name FROM documents 
             WHERE id = $1 AND (
                 ($2::uuid IS NOT NULL AND user_id = $2::uuid) OR 
                 ($3::uuid IS NOT NULL AND guest_id = $3::uuid)
             )`,
            [documentId, userId, guestId]
        );

        if (docResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found or access denied' });
        }

        const doc = docResult.rows[0];
        const cached = progressCache.get(documentId);

        return res.status(200).json({
            status: true,
            document_id: documentId,
            doc_status: doc.status,
            percentage: cached?.percentage ?? (doc.status === 'ready' ? 100 : 5),
            stage: cached?.stage ?? (doc.status === 'ready' ? 'completed' : 'processing'),
            message: cached?.message ?? (doc.status === 'ready' ? 'Document ready' : 'Processing document...')
        });
    } catch (err) {
        console.error('[Document Status Error]:', err);
        return res.status(500).json({ error: 'Failed to fetch document status' });
    }
};

// DELETE Document
export const deleteDocument = async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user?.id;
        const guestId = req.guest?.id;

        const docResult = await pool.query(`SELECT id, pinecone_namespace FROM documents WHERE id = $1 AND (user_id = $2 OR guest_id = $3)`, [documentId, userId, guestId]);

        if (docResult.rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Document not found or access denied'
            });
        }

        const doc = docResult.rows[0];

        if (doc.pinecone_namespace) {
            try {
                const index = getPineconeIndex();
                await index.namespace(doc.pinecone_namespace).deleteAll();
            } catch (err) {
                console.warn(`[DeleteDoc] Pinecone skipped/failed `, err.message);
            }
        }

        await pool.query(`DELETE FROM documents WHERE id = $1`, [documentId]);

        return res.status(200).json({
            status: true,
            message: 'Document deleted successfully'
        })
    } catch (err) {
        console.error('[Document Delete Failed]: ', err);
        return res.status(500).json({
            status: false,
            message: 'Somethine went wrong'
        });
    }
}

// GET List of the documents
export const getDocuments = async (req, res) => {
    try {
        const userId = req.user?.id;
        const guestId = req.guest?.id;

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, parseInt(req.query.limit) || 10);

        const offset = (page - 1) * limit;

        const countResult = await pool.query(`SELECT COUNT(*) FROM documents WHERE (user_id = $1 OR guest_id = $2)`, [userId, guestId]);

        const docResult = await pool.query(`SELECT id, file_name, file_size_bytes, mime_type, status, created_at FROM documents WHERE 
            (user_id = $1 OR guest_id = $2) ORDER BY created_at DESC LIMIT $3 OFFSET $4`, [userId, guestId, limit, offset]);

        return res.status(200).json({
            status: true,
            pagination: {
                total: countResult.rows[0].count,
                page,
                limit,
                totalPages: Math.ceil(countResult.rows[0].count / limit)
            },
            documents: docResult.rows,
            message: 'Documents fetched successfully'
        })
    } catch (err) {
        console.error('[Document Fetch Failed]: ', err);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
}