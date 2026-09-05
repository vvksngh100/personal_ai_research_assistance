import pool from "../config/db.js";
import { getPineconeIndex } from "../config/pinecone.js";

// Clean up service
export const cleanupExpiredGuestData = async (ttlHours = 1) => {
    try {
        // Purge Expired Guest Documents (older than ttlHours(1 hour))
        const cutOffDate = new Date(Date.now() - ttlHours * 60 * 60 * 1000);
        const cleanupQuery = `SELECT id, guest_id, pinecone_namespace from documents where user_id IS NULL AND created_at < $1`;
        const queryResult = await pool.query(cleanupQuery, [cutOffDate]);

        if(queryResult.rows){
            const index = getPineconeIndex();
            for(const doc of queryResult.rows){
                if(doc.pinecone_namespace){
                    try {                        
                        await index.namespace(doc.pinecone_namespace).deleteAll();
                    } catch (err) {
                        console.warn(`[Cleanup] Pinecone namespace delete skipped/failed: ${err.message}`);
                    }
                }
                const deleteQuery = `DELETE FROM documents where id = $1`;
                await pool.query(deleteQuery, [doc.id]);
            }
        }

        // Rescue Zombie Documents (stuck in 'processing' > 30 mins)
        const zombieResult = await pool.query(`UPDATE documents SET status='failed'
            WHERE status='processing' AND created_at < NOW() - INTERVAL '30 minutes' RETURNING id`);
        
        if(zombieResult.rows.length > 0){
            console.log(`[Cleanup] Marked ${zombieResult.rows.length} stuck processing documents as failed.`);
        }

        // Purge Abandoned 'failed' Documents (older than 24 hours)
        const failedDocsQuery = `SELECT id, pinecone_namespace 
        FROM documents
        WHERE status = 'failed' AND created_at < NOW() - INTERVAL '24 hours'`;
        const failedDocs = await pool.query(failedDocsQuery);

        for(const doc of failedDocs.rows){
            if(doc.pinecone_namespace){
                try {
                    await index.namespace(doc.pinecone_namespace).deleteAll();
                } catch (err) {
                    console.warn(`[Cleanup] Pinecone namespace delete skipped: ${err.message}`);
                }
            }
            await pool.query(`DELETE FROM documents WHERE id = $1`, [doc.id]);
        }

        // Purge Expired or Used Password Reset OTPs
        await pool.query(`DELETE FROM password_resets WHERE
            expires_at < NOW() OR is_used = TRUE`);
        console.log('[Cleanup] Expired password reset records purged.');
    } catch (err) {
        console.error('[CleanupService Error]: ', err.message);
    }
}