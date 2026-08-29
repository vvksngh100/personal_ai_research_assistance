import { PDFParse } from "pdf-parse";

export const extractTextFromPDF = async (buffer) => {
    try {
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        await parser.destroy();
        return data.text;
    } catch (error) {
        console.error('PDF parsing error: ', error);
        throw new Error('Failed to parse PDF document');
    }
};

export const chunkText = (text, maxChunkSize = 1000) => {
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];
    let currentChunk = '';

    for(const paragraph of paragraphs){
        if((currentChunk.length + paragraph.length) > maxChunkSize && currentChunk.length > 0){
            chunks.push(currentChunk.trim());
            currentChunk = "";
        }
        currentChunk += paragraph + "\n\n";
    }

    if(currentChunk.trim().length > 0){
        chunks.push(currentChunk.trim());
    }

    return chunks;
};