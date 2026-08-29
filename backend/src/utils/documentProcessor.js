import { PDFParse } from "pdf-parse";

export const extractTextFromPDF = async (buffer) => {
    try {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        await parser.destroy();
        
        const extractedText = (data && typeof data.text === 'string') ? data.text : '';
        console.log(`[PDF] Parsed ${data?.total || 0} pages, extracted ${extractedText.trim().length} text characters`);
        return extractedText;
    } catch (error) {
        console.error('PDF parsing error: ', error);
        throw new Error('Failed to parse PDF document');
    }
};

export const chunkText = (text, maxChunkSize = 1000, overlap = 100) => {
    if (!text || typeof text !== 'string') return [];

    const cleaned = text.replace(/\r\n/g, '\n').trim();
    if (!cleaned) return [];

    const paragraphs = cleaned
        .split(/\n\s*\n/)
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (paragraphs.length === 0) return [];

    const chunks = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        // If a single paragraph exceeds maxChunkSize, split it
        if (paragraph.length > maxChunkSize) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }
            for (let i = 0; i < paragraph.length; i += (maxChunkSize - overlap)) {
                const slice = paragraph.slice(i, i + maxChunkSize).trim();
                if (slice.length > 0) {
                    chunks.push(slice);
                }
            }
            continue;
        }

        if ((currentChunk.length + paragraph.length + 2) > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());
            currentChunk = '';
        }

        currentChunk = currentChunk ? `${currentChunk}\n\n${paragraph}` : paragraph;
    }

    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
};