import { parentPort } from 'node:worker_threads';
import { PDFParse } from 'pdf-parse';
import { chunkText } from '../utils/documentProcessor.js';

parentPort.on('message', async (message) => {
    const { id, buffer, maxChunkSize = 1000, overlap = 100 } = message;

    try {
        const pdfBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
        const parser = new PDFParse({ data: pdfBuffer });
        const data = await parser.getText();
        await parser.destroy();

        const extractedText = (data && typeof data.text === 'string') ? data.text : '';
        const totalPages = data?.total || 0;
        const textLength = extractedText.trim().length;

        console.log(`[PDFWorker] Parsed ${totalPages} pages, extracted ${textLength} characters`);

        const chunks = chunkText(extractedText, maxChunkSize, overlap);

        parentPort.postMessage({
            id,
            status: 'SUCCESS',
            totalPages,
            textLength,
            chunks,
            text: extractedText
        });
    } catch (error) {
        console.error('[PDFWorker] PDF parsing error:', error.message);
        parentPort.postMessage({
            id,
            status: 'ERROR',
            error: error.message || 'Failed to parse PDF document'
        });
    }
});
