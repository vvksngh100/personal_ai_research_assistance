import { Pinecone } from "@pinecone-database/pinecone";
import { configDotenv } from "dotenv";
configDotenv();

const pinecone = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});

export const getPineconeIndex = () => {
    return pinecone.index(process.env.PINECONE_INDEX_NAME);
};

export default pinecone;