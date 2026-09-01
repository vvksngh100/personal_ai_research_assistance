import express from 'express';
import { configDotenv } from 'dotenv';
import { query } from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import { globalRateLimiter } from './src/config/rateLimiter.js';
import { setupSwagger } from './src/config/swagger.js';
import cors from 'cors';
import uploadRouter from './src/routes/uploadRoutes.js';
import chatRoutes from './src/routes/chatRoutes.js';

configDotenv();

const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

setupSwagger(app);

app.use(globalRateLimiter);

app.get('/', (req,res) => {
    res.send('Hello World');
});

// Auth routes
app.use('/api/auth', authRoutes);

// Upload routes
app.use('/api/upload', uploadRouter);

// Chat & RAG routes
app.use('/api/chat', chatRoutes);

app.listen(PORT, async () => {
    console.log(`Server is started at port ${PORT}`);

    try {
        const result = await query('SELECT NOW()');
        console.log('Database is connected at: ', result.rows[0].now);
    } catch (err) {
        console.error('Database connection failed: ', err.message);
    }
});