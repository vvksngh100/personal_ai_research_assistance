/**
 * In-Memory Dual-Lane Concurrency Limiter for Document Vectorization.
 * 
 * Implements QoS (Quality of Service) scheduling:
 * - FAST LANE: For small documents (<= 15 chunks, e.g. 1-3 pages or ~50KB-500KB).
 *   Bypasses heavy documents so users don't wait minutes for a 2-second job.
 * - STANDARD LANE: For large research documents (> 15 chunks, e.g. 10MB/77 pages).
 *   Constrained to 1 concurrent task to prevent RAM spikes beyond Render's 512MB limit.
 */

export const FAST_LANE_CHUNK_THRESHOLD = 15;

class DualLaneUploadQueue {
    constructor({ maxStandard = 1, maxFast = 1 } = {}) {
        this.maxStandard = maxStandard;
        this.maxFast = maxFast;

        this.runningStandard = 0;
        this.runningFast = 0;

        this.standardQueue = [];
        this.fastQueue = [];
    }

    /**
     * Enqueues a document processing task into the appropriate lane.
     * 
     * @param {Object} task
     * @param {string} task.documentId
     * @param {number} task.chunksCount - Total chunk count to determine lane
     * @param {Function} task.execute - Async function to run document vectorization
     * @param {Function} task.emitProgress - Callback to notify the client over SSE
     */
    enqueue(task) {
        const isFast = (task.chunksCount || 0) <= FAST_LANE_CHUNK_THRESHOLD;
        task.lane = isFast ? 'fast' : 'standard';

        if (isFast) {
            this.fastQueue.push(task);
            console.log(`[UploadQueue] [FAST LANE] Document ${task.documentId} (${task.chunksCount} chunks) enqueued. Queue length: ${this.fastQueue.length}, Active fast: ${this.runningFast}`);
            this.notifyQueuePositions('fast');
            this.processNext('fast');
        } else {
            this.standardQueue.push(task);
            console.log(`[UploadQueue] [STANDARD LANE] Document ${task.documentId} (${task.chunksCount} chunks) enqueued. Queue length: ${this.standardQueue.length}, Active standard: ${this.runningStandard}`);
            this.notifyQueuePositions('standard');
            this.processNext('standard');
        }
    }

    /**
     * Broadcasts updated queue position to all waiting tasks in a specific lane.
     */
    notifyQueuePositions(lane) {
        const queue = lane === 'fast' ? this.fastQueue : this.standardQueue;
        const laneName = lane === 'fast' ? 'Fast Lane' : 'Standard Lane';

        queue.forEach((task, index) => {
            const position = index + 1;
            task.emitProgress({
                status: 'processing',
                stage: 'queued',
                lane,
                percentage: 2,
                queue_position: position,
                total_in_queue: queue.length,
                message: position === 1 
                    ? `Up next in ${laneName}! Preparing document processor...`
                    : `Queued in ${laneName} (Position #${position} in line)...`
            });
        });
    }

    /**
     * Dispatches the next task in the specified lane if concurrency limit allows.
     */
    async processNext(lane) {
        if (lane === 'fast') {
            if (this.runningFast >= this.maxFast || this.fastQueue.length === 0) {
                return;
            }

            this.runningFast++;
            const task = this.fastQueue.shift();
            this.notifyQueuePositions('fast');

            console.log(`[UploadQueue] [FAST LANE] Starting processing for document ${task.documentId} (${task.chunksCount} chunks).`);

            try {
                await task.execute();
            } catch (error) {
                console.error(`[UploadQueue] Fast lane task error for document ${task.documentId}:`, error);
            } finally {
                this.runningFast--;
                console.log(`[UploadQueue] [FAST LANE] Completed document ${task.documentId}. Active: ${this.runningFast}, Waiting: ${this.fastQueue.length}`);
                this.processNext('fast');
            }
        } else {
            if (this.runningStandard >= this.maxStandard || this.standardQueue.length === 0) {
                return;
            }

            this.runningStandard++;
            const task = this.standardQueue.shift();
            this.notifyQueuePositions('standard');

            console.log(`[UploadQueue] [STANDARD LANE] Starting processing for document ${task.documentId} (${task.chunksCount} chunks).`);

            try {
                await task.execute();
            } catch (error) {
                console.error(`[UploadQueue] Standard lane task error for document ${task.documentId}:`, error);
            } finally {
                this.runningStandard--;
                console.log(`[UploadQueue] [STANDARD LANE] Completed document ${task.documentId}. Active: ${this.runningStandard}, Waiting: ${this.standardQueue.length}`);
                this.processNext('standard');
            }
        }
    }

    /**
     * Returns current queue statistics across both lanes
     */
    getStats() {
        return {
            fast: {
                running: this.runningFast,
                waiting: this.fastQueue.length,
                max: this.maxFast
            },
            standard: {
                running: this.runningStandard,
                waiting: this.standardQueue.length,
                max: this.maxStandard
            },
            totalActive: this.runningFast + this.runningStandard
        };
    }
}

// Bounded concurrency: 1 standard + 1 fast guarantees peak RAM stays below ~290MB
const maxStandard = parseInt(process.env.MAX_CONCURRENT_UPLOADS, 10) || 1;
const maxFast = parseInt(process.env.MAX_FAST_LANE_UPLOADS, 10) || 1;

export const uploadQueue = new DualLaneUploadQueue({ maxStandard, maxFast });
