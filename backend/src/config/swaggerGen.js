import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { configDotenv } from 'dotenv';

configDotenv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

const doc = {
  openapi: '3.0.0',
  info: {
    title: 'Personal AI Research Assistant API',
    description: 'API documentation for PDF upload, vectorization, and RAG assistant',
    version: '1.0.0',
  },
  servers: [
    {
      url: `http://localhost:${PORT}`,
      description: 'Development server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token obtained from /api/auth/guest-id. Swagger UI will automatically attach the "Bearer " prefix.',
      },
    },
  },
  paths: {
    "/": {
      get: {
        tags: ["Health"],
        summary: "Health check / Welcome endpoint",
        responses: {
          200: {
            description: "Server is running",
          },
        },
      },
    },
    "/api/auth/guest-id": {
      get: {
        tags: ["Auth"],
        summary: "Generate guest JWT token",
        description: "Creates an anonymous guest session and returns a JWT token for authenticating subsequent requests.",
        responses: {
          200: {
            description: "Guest token successfully created",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    guestToken: { type: "string" },
                    token: { type: "string" },
                    guest_id: { type: "string" },
                  },
                },
              },
            },
          },
          500: {
            description: "Internal Server Error",
          },
        },
      },
    },
    "/api/upload": {
      post: {
        tags: ["Upload"],
        summary: "Upload and vectorize a PDF document",
        description: "Uploads a PDF file, parses text, generates embeddings, and indexes them in Pinecone under the user's namespace.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                properties: {
                  file: {
                    type: "string",
                    format: "binary",
                    description: "PDF file to upload and vectorize (max 10MB)",
                  },
                },
                required: ["file"],
              },
            },
          },
        },
        responses: {
          201: {
            description: "Document processed and vectorized successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    message: { type: "string" },
                    document_id: { type: "string" },
                    chunks_processed: { type: "integer" },
                  },
                },
              },
            },
          },
          400: {
            description: "Bad Request (missing file or non-PDF file)",
          },
          401: {
            description: "Unauthorized (missing or invalid Bearer token)",
          },
          429: {
            description: "Too many requests / Rate limited",
          },
          500: {
            description: "Failed to process and vectorize document",
          },
        },
      },
    },
    "/api/chat": {
      post: {
        tags: ["Chat & RAG"],
        summary: "Send query to RAG assistant (supports REST JSON and SSE Streaming)",
        description: "Queries Pinecone vector store for relevant document chunks and synthesizes an answer via Google Gemini. Set 'stream: false' for standard REST JSON or 'stream: true' for Server-Sent Events (SSE) token streaming.",
        security: [
          {
            bearerAuth: [],
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  document_id: {
                    type: "string",
                    format: "uuid",
                    description: "UUID of the vectorized document to query",
                    example: "a81d42be-5a7c-4861-a083-d56736466f28",
                  },
                  message: {
                    type: "string",
                    description: "Question or research query",
                    example: "What are the main conclusions of this research paper?",
                  },
                  session_id: {
                    type: "string",
                    format: "uuid",
                    description: "Optional existing chat session UUID to maintain conversation memory",
                  },
                  stream: {
                    type: "boolean",
                    description: "Set to true for real-time SSE streaming, false for standard JSON response",
                    default: false,
                  },
                },
                required: ["document_id", "message"],
              },
            },
          },
        },
        responses: {
          200: {
            description: "Successful response (REST JSON format)",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    session_id: { type: "string" },
                    user_message_id: { type: "string" },
                    assistant_message_id: { type: "string" },
                    answer: { type: "string" },
                    sources: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          source_id: { type: "integer" },
                          chunk_index: { type: "integer" },
                          relevance_score: { type: "number" },
                          text: { type: "string" },
                        },
                      },
                    },
                    created_at: { type: "string" },
                  },
                },
              },
            },
          },
          400: {
            description: "Bad Request (missing required fields or document not ready)",
          },
          401: {
            description: "Unauthorized (missing or invalid Bearer token)",
          },
          404: {
            description: "Document or chat session not found",
          },
          500: {
            description: "Internal Server Error during retrieval or generation",
          },
        },
      },
    },
    "/api/chat/sessions/{documentId}": {
      get: {
        tags: ["Chat & RAG"],
        summary: "Get all chat sessions for a document",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "documentId",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
            description: "Document UUID",
          },
        ],
        responses: {
          200: {
            description: "List of chat sessions",
          },
          401: {
            description: "Unauthorized",
          },
          500: {
            description: "Internal Server Error",
          },
        },
      },
    },
    "/api/chat/messages/{sessionId}": {
      get: {
        tags: ["Chat & RAG"],
        summary: "Get message history for a chat session",
        security: [
          {
            bearerAuth: [],
          },
        ],
        parameters: [
          {
            name: "sessionId",
            in: "path",
            required: true,
            schema: {
              type: "string",
              format: "uuid",
            },
            description: "Chat Session UUID",
          },
        ],
        responses: {
          200: {
            description: "Chat history for session",
          },
          401: {
            description: "Unauthorized",
          },
          404: {
            description: "Session not found",
          },
          500: {
            description: "Internal Server Error",
          },
        },
      },
    },
  },
};

const outputPath = path.join(__dirname, 'swagger-output.json');
fs.writeFileSync(outputPath, JSON.stringify(doc, null, 2), 'utf-8');
console.log('✅ Swagger documentation successfully generated at:', outputPath);