import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import { getPineconeIndex } from '../config/pinecone.js';
import { extractTextFromPDF, chunkText } from '../utils/documentProcessor.js';
import { generateBatchEmbeddings } from '../services/embeddingService.js';

export const uploadDocument = async (req, res) => {
    let documentId = null;
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No PDF file uploaded' });
        }

        // Determine ownership
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
        await pool.query(insertDocQuery, [
            documentId,
            userId,
            guestId,
            fileName,
            'memory_storage', // Or Supabase storage URL if saving the raw file
            fileSize,
            req.file.mimetype,
            namespace
        ]);

        // Extract text & create chunks
        const text = await extractTextFromPDF(req.file.buffer);

        if (!text || text.trim().length === 0) {
            console.warn(`[Upload] PDF "${fileName}" contained 0 extractable text characters.`);
            await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['failed', documentId]);
            return res.status(400).json({
                error: 'No text could be extracted from this PDF. It may be an image-only scan, blank, or password-protected.'
            });
        }

        const chunks = chunkText(text);
        console.log(`[Upload] Generated ${chunks.length} chunks for "${fileName}"`);

        if (chunks.length === 0) {
            console.warn(`[Upload] Chunking produced 0 chunks for "${fileName}".`);
            await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['failed', documentId]);
            return res.status(400).json({
                error: 'Failed to create text chunks from the document.'
            });
        }

        // Generate embeddings via Transformers.js
        console.log(`[Upload] Generating embeddings for ${chunks.length} chunk(s)...`);
        const embeddedChunks = await generateBatchEmbeddings(chunks);

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
            await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['failed', documentId]);
            return res.status(400).json({ error: 'No vector embeddings generated for document' });
        }

        // Upsert to Pinecone under document namespace
        console.log(`[Upload] Upserting ${vectors.length} vector(s) to Pinecone namespace: ${namespace}...`);
        const index = getPineconeIndex();
        await index.namespace(namespace).upsert({ records: vectors });

        // Mark document as ready in PostgreSQL
        await pool.query('UPDATE documents SET status = $1 WHERE id = $2', ['ready', documentId]);

        return res.status(201).json({
            message: 'Document processed and vectorized successfully',
            document_id: documentId,
            chunks_processed: vectors.length
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
        return res.status(500).json({ error: 'Failed to process and vectorize document' });
    }
};

// DELETE Document
export const deleteDocument = async (req, res) => {
    try {
        const documentId = req.params.id;
        const userId = req.user?.id;
        const guestId = req.guest?.id;

        const docResult = await pool.query(`SELECT id, pinecone_namespace FROM documents WHERE id = $1 AND (user_id = $2 OR guest_id = $3)`, [documentId, userId, guestId]);

        if(docResult.rows.length === 0){
            return res.status(404).json({
                status: false,
                message: 'Document not found or access denied'
            });
        }

        const doc = docResult.rows[0];

        if(doc.pinecone_namespace){
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