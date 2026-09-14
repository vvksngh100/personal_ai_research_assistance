import { v4 as uuidv4 } from 'uuid';
import pool from '../config/db.js';
import validator from '../utils/validator.js';
import { getPineconeIndex } from '../config/pinecone.js';
import { retrieveContext, buildGroundedPrompt } from '../services/ragService.js';
import { generateCompletion, generateStream } from '../services/geminiService.js';

/**
 * Sends a message within a chat session for a specific document.
 * Supports both standard REST JSON (stream: false) and SSE streaming (stream: true).
 */
export const sendMessage = async (req, res) => {
    let headersSent = false;
    try {
        const { document_id, message, session_id, stream = false } = req.body;

        if (!document_id) {
            return res.status(400).json({ error: 'document_id is required' });
        }

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            return res.status(400).json({ error: 'message must be a non-empty string' });
        }

        const userId = req.user ? req.user.id : null;
        const guestId = req.guest ? req.guest.guest_id : null;

        if (!userId && !guestId) {
            return res.status(401).json({ error: 'Unauthorized: missing user or guest identity' });
        }

        // 1. Authorize document ownership & readiness
        const docCheckQuery = `
            SELECT id, file_name, status, pinecone_namespace
            FROM documents
            WHERE id = $1 AND (user_id = $2 OR guest_id = $3);
        `;
        const docResult = await pool.query(docCheckQuery, [document_id, userId, guestId]);

        if (docResult.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found or you do not have permission to access it.' });
        }

        const document = docResult.rows[0];
        if (document.status !== 'ready') {
            return res.status(400).json({
                error: `Document is not ready for chat. Current status: "${document.status}".`
            });
        }

        // 2. Resolve or create chat session
        let activeSessionId = session_id;

        if (activeSessionId) {
            const sessionQuery = `
                SELECT id FROM chat_sessions
                WHERE id = $1 AND document_id = $2 AND (user_id = $3 OR guest_id = $4);
            `;
            const sessionResult = await pool.query(sessionQuery, [activeSessionId, document_id, userId, guestId]);

            if (sessionResult.rows.length === 0) {
                return res.status(404).json({ error: 'Chat session not found for this document.' });
            }
        } else {
            activeSessionId = uuidv4();
            const sessionTitle = message.trim().slice(0, 45) + (message.length > 45 ? '...' : '');
            const createSessionQuery = `
                INSERT INTO chat_sessions (id, user_id, guest_id, document_id, title)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `;
            await pool.query(createSessionQuery, [
                activeSessionId,
                userId,
                guestId,
                document_id,
                sessionTitle
            ]);
        }

        // 3. Fetch recent conversation turns (up to 4 past messages) for contextual continuity
        const historyQuery = `
            SELECT role, content
            FROM messages
            WHERE session_id = $1
            ORDER BY created_at DESC
            LIMIT 4;
        `;
        const historyResult = await pool.query(historyQuery, [activeSessionId]);
        const conversationHistory = historyResult.rows.reverse();

        // 4. Save user message to PostgreSQL
        const userMsgId = uuidv4();
        await pool.query(
            `INSERT INTO messages (id, session_id, role, content, metadata) VALUES ($1, $2, 'user', $3, '{}')`,
            [userMsgId, activeSessionId, message.trim()]
        );

        // 5. Retrieve context from Pinecone and build prompt
        const retrievedChunks = await retrieveContext(document_id, message.trim());
        const { systemInstruction, prompt } = buildGroundedPrompt(
            message.trim(),
            retrievedChunks,
            conversationHistory
        );

        const sanitizedSources = retrievedChunks.map(chunk => ({
            source_id: chunk.source_id,
            chunk_index: chunk.chunk_index,
            relevance_score: Number((chunk.score * 100).toFixed(1)),
            text: chunk.text
        }));

        // 6. Response Strategy: SSE Streaming vs. REST JSON
        if (stream === true) {
            // Set SSE response headers
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.flushHeaders();
            headersSent = true;

            // Event 1: Send retrieved sources and session ID immediately
            res.write(`data: ${JSON.stringify({
                type: 'sources',
                session_id: activeSessionId,
                user_message_id: userMsgId,
                sources: sanitizedSources
            })}\n\n`);

            // Event 2..N: Stream LLM tokens in real time
            const assistantMsgId = uuidv4();
            const fullResponse = await generateStream({
                prompt,
                systemInstruction,
                onChunk: (token) => {
                    res.write(`data: ${JSON.stringify({
                        type: 'token',
                        text: token
                    })}\n\n`);
                }
            });

            // Persist generated assistant response into database
            await pool.query(
                `INSERT INTO messages (id, session_id, role, content, metadata) VALUES ($1, $2, 'assistant', $3, $4)`,
                [assistantMsgId, activeSessionId, fullResponse, JSON.stringify({ sources: sanitizedSources })]
            );

            // Final Event: Signal completion
            res.write(`data: ${JSON.stringify({
                type: 'done',
                session_id: activeSessionId,
                message_id: assistantMsgId
            })}\n\n`);

            return res.end();

        } else {
            // Standard REST JSON completion
            const answer = await generateCompletion({
                prompt,
                systemInstruction
            });

            const assistantMsgId = uuidv4();
            await pool.query(
                `INSERT INTO messages (id, session_id, role, content, metadata) VALUES ($1, $2, 'assistant', $3, $4)`,
                [assistantMsgId, activeSessionId, answer, JSON.stringify({ sources: sanitizedSources })]
            );

            return res.status(200).json({
                session_id: activeSessionId,
                user_message_id: userMsgId,
                assistant_message_id: assistantMsgId,
                answer,
                sources: sanitizedSources,
                created_at: new Date().toISOString()
            });
        }

    } catch (error) {
        console.error('[ChatController] Error processing chat:', error);

        if (headersSent) {
            res.write(`data: ${JSON.stringify({
                type: 'error',
                error: error.message || 'An error occurred during generation'
            })}\n\n`);
            return res.end();
        }

        return res.status(500).json({
            error: 'Failed to process chat query',
            details: error.message
        });
    }
};


// Retrieves all chat sessions associated with a specific document.
export const getChatSessions = async (req, res) => {
    try {
        const userId = req.user ? req.user.id : null;
        const guestId = req.guest ? req.guest.guest_id : null;

        // Auto-heal: Ensure every document owned by the user/guest has at least one chat session
        try {
            await pool.query(
                `INSERT INTO chat_sessions (user_id, guest_id, document_id, title)
                 SELECT d.user_id, d.guest_id, d.id, d.file_name
                 FROM documents d
                 WHERE (($1::uuid IS NOT NULL AND d.user_id = $1::uuid) OR ($2::uuid IS NOT NULL AND d.guest_id = $2::uuid))
                   AND d.status != 'failed'
                   AND NOT EXISTS (
                       SELECT 1 FROM chat_sessions cs WHERE cs.document_id = d.id
                   )`,
                [userId, guestId]
            );
        } catch (healErr) {
            console.warn('[Auto-heal sessions warning]:', healErr.message);
        }

        const { cursor, documentId, search } = req.query;
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit)) || 15);

        // Build Query
        const queryParams = [userId, guestId];
        let sessionsQuery = `
            SELECT cs.id, cs.title, cs.document_id, cs.created_at, d.file_name
            FROM chat_sessions cs
            LEFT JOIN documents d ON cs.document_id = d.id
            WHERE (cs.user_id = $1 OR cs.guest_id = $2)
        `;

        if (documentId) {
            queryParams.push(documentId);
            sessionsQuery += ` AND cs.document_id = $${queryParams.length}`;
        }

        if (search && search.trim()) {
            queryParams.push(`%${search.trim()}%`);
            sessionsQuery += ` AND (cs.title ILIKE $${queryParams.length} OR d.file_name ILIKE $${queryParams.length})`;
        }


        if (cursor) {
            const cursorDate = new Date(cursor);
            if (isNaN(cursorDate.getTime())) {
                return res.status(400).json({ error: 'Invalid cursor timestamp format' });
            }
            queryParams.push(cursorDate);
            sessionsQuery += ` AND cs.created_at < $${queryParams.length}`;
        }

        queryParams.push(limit + 1);
        sessionsQuery += ` ORDER BY cs.created_at DESC LIMIT $${queryParams.length}`;

        const queryResult = await pool.query(sessionsQuery, queryParams);

        const hasMore = queryResult.rows.length > limit;
        const sessions = hasMore ? queryResult.rows.slice(0, limit) : queryResult.rows;
        const nextCursor = hasMore ? sessions[sessions.length - 1].created_at : null;

        return res.status(200).json({
            status: true,
            sessions,
            pagination: {
                hasMore,
                nextCursor,
            }
        });
    } catch (error) {
        console.error('[ChatController] Error fetching sessions:', error);
        return res.status(500).json({ error: 'Failed to retrieve chat sessions' });
    }
};

// Retrieves messages within a specific chat session with cursor pagination.
export const getChatMessages = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { cursor } = req.query;
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit)) || 20);
        const userId = req.user ? req.user.id : null;
        const guestId = req.guest ? req.guest.guest_id : null;

        // Verify session ownership
        const sessionCheck = await pool.query(
            `SELECT id, document_id, title FROM chat_sessions WHERE id = $1 AND (user_id = $2 OR guest_id = $3)`,
            [sessionId, userId, guestId]
        );

        if (sessionCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Chat session not found or access denied' });
        }

        const queryParams = [sessionId];
        let messagesQuery = `
            SELECT id, role, content, metadata, created_at
            FROM messages
            WHERE session_id = $1
        `;

        if (cursor) {
            const cursorDate = new Date(cursor);
            if (isNaN(cursorDate.getTime())) {
                return res.status(400).json({ error: 'Invalid cursor timestamp format' });
            }
            queryParams.push(cursorDate);
            messagesQuery += ` AND created_at < $${queryParams.length}`;
        }

        queryParams.push(limit + 1);
        messagesQuery += ` ORDER BY created_at DESC LIMIT $${queryParams.length}`;

        const result = await pool.query(messagesQuery, queryParams);

        const hasMore = result.rows.length > limit;
        const slicedRows = hasMore ? result.rows.slice(0, limit) : result.rows;
        const nextCursor = hasMore ? slicedRows[slicedRows.length - 1].created_at : null;

        // Reverse to return in natural chronological order (oldest to newest) for chat rendering
        const messages = slicedRows.reverse();

        return res.status(200).json({
            status: true,
            session: sessionCheck.rows[0],
            messages,
            pagination: {
                hasMore,
                nextCursor,
            }
        });
    } catch (error) {
        console.error('[ChatController] Error fetching messages:', error);
        return res.status(500).json({ error: 'Failed to retrieve messages' });
    }
};


// DELETE Chat Session & Associated Document + Pinecone Vectors
export const deleteChatSession = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const userId = req.user?.id || null;
        const guestId = req.guest?.guest_id || req.guest?.id || null;

        // 1. Fetch the chat session to verify ownership and find the associated document_id
        const sessionResult = await pool.query(
            `SELECT id, document_id FROM chat_sessions 
             WHERE id = $1 AND (($2::uuid IS NOT NULL AND user_id = $2::uuid) OR ($3::uuid IS NOT NULL AND guest_id = $3::uuid))`,
            [sessionId, userId, guestId]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Chat session not found or access denied.'
            });
        }

        const { document_id: documentId } = sessionResult.rows[0];

        // 2. If an associated document exists, clean up its Pinecone vectors and database entry
        if (documentId) {
            const siblingSessions = await pool.query(
                `SELECT id FROM chat_sessions WHERE document_id = $1 AND id != $2`,
                [documentId, sessionId]
            );

            // If this is the only session referencing this document (standard 1:1 UI flow):
            if (siblingSessions.rows.length === 0) {
                const docResult = await pool.query(
                    `SELECT id, pinecone_namespace FROM documents WHERE id = $1`,
                    [documentId]
                );

                if (docResult.rows.length > 0) {
                    const doc = docResult.rows[0];
                    if (doc.pinecone_namespace) {
                        try {
                            const index = getPineconeIndex();
                            await index.namespace(doc.pinecone_namespace).deleteAll();
                            console.log(`[DeleteChatSession] Wiped Pinecone namespace: ${doc.pinecone_namespace}`);
                        } catch (pineconeErr) {
                            console.warn(`[DeleteChatSession] Pinecone namespace delete skipped/failed:`, pineconeErr.message);
                        }
                    }

                    // Deleting the document cascades and deletes chat_session and messages in PostgreSQL
                    await pool.query(`DELETE FROM documents WHERE id = $1`, [documentId]);
                    console.log(`[DeleteChatSession] Cleanly deleted document ${documentId} and cascaded session ${sessionId}`);

                    return res.status(200).json({
                        status: true,
                        message: 'Chat session, document, and vector index deleted successfully'
                    });
                }
            }
        }

        // 3. Fallback: If no document or other sessions still share the document, delete just the chat session
        await pool.query(`DELETE FROM chat_sessions WHERE id = $1`, [sessionId]);

        return res.status(200).json({
            status: true,
            message: 'Chat session deleted successfully'
        });
    } catch (err) {
        console.error('[Chat Session Deletion Failed]: ', err);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
};

// UPDATE Chat session
export const updateChatSession = async (req, res) => {
    try {
        const sessionId = req.params.sessionId;
        const userId = req.user?.id;
        const guestId = req.guest?.guest_id || req.guest?.id || null;
        const { sessionTitle } = req.body;

        const validationRule = {
            sessionTitle: 'required|string'
        };

        const validationResult = validator(req.body, validationRule);

        if (validationResult.fails()) {
            return res.status(400).json({
                status: false,
                message: 'Validation Failed',
                details: validationResult.errors.all()
            });
        }

        const queryResult = await pool.query(`UPDATE chat_sessions 
            SET title = $1 
            WHERE id = $2 AND (user_id = $3 OR guest_id = $4) RETURNING id, title, document_id, created_at`, [sessionTitle, sessionId, userId, guestId]);

        if (queryResult.rows.length === 0) {
            return res.status(404).json({
                status: false,
                message: 'Chat session not found or access denied',
            });
        }

        return res.status(200).json({
            status: true,
            message: 'Chat session updated successfully',
            session: queryResult.rows[0]
        })
    } catch (err) {
        console.error('[Update Chat Session Failed]: ', err);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
}