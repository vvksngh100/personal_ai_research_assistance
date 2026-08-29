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

        // 1. Initial DB record creation
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

        // 2. Extract text & create chunks
        const text = await extractTextFromPDF(req.file.buffer);
        const chunks = chunkText(text);

        // 3. Generate embeddings via Transformers.js
        const embeddedChunks = await generateBatchEmbeddings(chunks);

        // 4. Format vectors for Pinecone
        const vectors = embeddedChunks.map((item, index) => ({
            id: `${documentId}_chunk_${index}`,
            values: item.embedding,
            metadata: {
                document_id: documentId,
                chunk_index: index,
                text: item.chunk
            }
        }));

        // 5. Upsert to Pinecone under document namespace
        const index = getPineconeIndex();
        await index.namespace(namespace).upsert(vectors);

        // 6. Mark document as ready in PostgreSQL
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