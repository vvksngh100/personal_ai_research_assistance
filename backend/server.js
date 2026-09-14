import express from 'express';
import { configDotenv } from 'dotenv';
import { query } from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import { globalRateLimiter } from './src/config/rateLimiter.js';
import { setupSwagger } from './src/config/swagger.js';
import cors from 'cors';
import uploadRouter from './src/routes/uploadRoutes.js';
import chatRoutes from './src/routes/chatRoutes.js';
import { startGuestCleanupJob } from './src/jobs/guestCleanupJob.js';
import { warmUpEmbeddingModel } from './src/services/embeddingService.js';

configDotenv();

const PORT = process.env.PORT || 3000;

const app = express();

app.set('trust proxy', 1);

app.use(cors());
app.use(express.json());

setupSwagger(app);

app.use(globalRateLimiter);

// Auth routes
app.use('/api/auth', authRoutes);

// Upload routes
app.use('/api/upload', uploadRouter);

// Chat & RAG routes
app.use('/api/chat', chatRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
    res.status(404).json({ error: `Cannot ${req.method} ${req.originalUrl}` });
});

// Centralized Express error handler
app.use((err, req, res, next) => {
    console.error('[Unhandled Error]:', err);

    // Handle JSON parsing errors from express.json()
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Malformed JSON payload in request body' });
    }

    const statusCode = err.status || err.statusCode || 500;
    res.status(statusCode).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message || 'Internal Server Error'
    });
});

const server = app.listen(PORT, async () => {
    console.log(`Server is started at port ${PORT}`);

    startGuestCleanupJob();
    warmUpEmbeddingModel();

    await connectToDatabase();

    async function connectToDatabase(maxTries=5, initialDelay=1000){
        for(let attempt = 1; attempt <= maxTries; attempt++){
            try {
                const result = await query('SELECT NOW()');
                console.log('[Database Connect]: ', result.rows[0].now);
                return true;
            } catch (err) {
                console.error(`[Database Connection Failed] (attempt ${attempt/maxTries}): `, err.message);
            }

            if(attempt === maxTries){
                console.error(`[Retries Exausted]: All retry attempts exhausted. Exiting...`)
                process.exit(1);
            }

            const delay = initialDelay * Math.pow(2, attempt - 1);
            console.log(`[Retrying]: Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
});

server.keepAliveTimeout = 120000;
server.headersTimeout = 125000;