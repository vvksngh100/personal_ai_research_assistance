import cron from 'node-cron';
import { cleanupExpiredGuestData } from '../services/cleanupService.js';

export const startGuestCleanupJob = () => {
    cron.schedule('0 */30 * * * *', async() => {
        console.log('[Cron] Checking for expired guest data...');
        await cleanupExpiredGuestData();
    });
};