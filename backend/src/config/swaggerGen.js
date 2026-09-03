import swaggerAutogen from 'swagger-autogen';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { configDotenv } from 'dotenv';

configDotenv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 5000;

const doc = {
  info: {
    title: 'Personal AI Research Assistant API',
    description: 'Auto-generated API documentation for PDF upload, vectorization, and RAG assistant',
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
        description: 'Enter your JWT token obtained from /api/auth/guest-id, /api/auth/register, or /api/auth/login.',
      },
    },
  },
};

const outputFile = path.join(__dirname, 'swagger-output.json').replace(/\\/g, '/');
const endpointsFiles = [path.join(__dirname, '../../server.js').replace(/\\/g, '/')];

const autogen = swaggerAutogen({ openapi: '3.0.0' });

await autogen(outputFile, endpointsFiles, doc);

// Automatically categorize endpoints by route prefix (Zero controller comments needed)
if (fs.existsSync(outputFile)) {
  const generated = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  if (generated.paths) {
    for (const [routePath, methods] of Object.entries(generated.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (typeof operation === 'object' && operation !== null) {
          // Auto-tag based on route URL prefix (/api/auth -> Auth, /api/chat -> Chat, etc.)
          if (!operation.tags || operation.tags.length === 0) {
            const segments = routePath.split('/').filter(Boolean);
            let tag = 'General';
            if (segments.length === 0) {
              tag = 'Health';
            } else if (segments[0] === 'api' && segments.length > 1) {
              tag = segments[1].charAt(0).toUpperCase() + segments[1].slice(1);
            } else {
              tag = segments[0].charAt(0).toUpperCase() + segments[0].slice(1);
            }
            operation.tags = [tag];
          }

          // Auto-summary based on HTTP method and path
          if (!operation.summary) {
            const cleanPath = routePath.replace(/^\/api\//, '/').replace(/\/$/, '');
            operation.summary = `${method.toUpperCase()} ${cleanPath || '/'}`;
          }

          // Auto-attach bearerAuth security to protected endpoints
          const publicRoutes = ['/', '/api/auth/guest-id', '/api/auth/register', '/api/auth/login'];
          if (!publicRoutes.includes(routePath)) {
            if (!operation.security) {
              operation.security = [{ bearerAuth: [] }];
            }
          }
        }
      }
    }
    fs.writeFileSync(outputFile, JSON.stringify(generated, null, 2), 'utf8');
  }
}

console.log('Swagger documentation automatically generated at:', outputFile);