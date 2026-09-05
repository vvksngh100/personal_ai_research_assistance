import pool from "../config/db.js";
import { getPineconeIndex } from "../config/pinecone.js";

// Clean up service
export const cleanupExpiredGuestData = async (ttlHours = 1) => {
    try {
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

        await pool.query(`DELETE FROM password_resets WHERE
            expires_at < NOW() OR is_used = TRUE`);
        console.log('[Cleanup] Expired password reset records purged.');
    } catch (err) {
        console.error('[CleanupService Error]: ', err.message);
    }


}