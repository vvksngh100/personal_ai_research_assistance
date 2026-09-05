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

app.use(cors());
app.use(express.json());

setupSwagger(app);

app.use(globalRateLimiter);

app.get('/', (req, res) => {
    res.send('Hello World');
});

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

app.listen(PORT, async () => {
    console.log(`Server is started at port ${PORT}`);

    startGuestCleanupJob();
    warmUpEmbeddingModel();

    try {
        const result = await query('SELECT NOW()');
        console.log('Database is connected at: ', result.rows[0].now);
    } catch (err) {
        console.error('Database connection failed: ', err.message);
    }
});