import express from 'express';
import { configDotenv } from 'dotenv';
import bodyParser from 'body-parser';
import { query } from './src/config/db.js';
import authRoutes from './src/routes/authRoutes.js';
import { globalRateLimiter } from './src/config/rateLimiter.js';

configDotenv();

const PORT = process.env.PORT;

const app = express();

app.use(bodyParser.json());

app.use(globalRateLimiter);

app.get('/', (req,res) => {
    res.send('Hello World');
});

// Auth routes
app.use('/api/auth', authRoutes);

app.listen(PORT, async () => {
    console.log(`Server is started at port ${PORT}`);

    try {
        const result = await query('SELECT NOW()');
        console.log('Database is connected at: ', result.rows[0].now);
    } catch (err) {
        console.error('Database connection failed: ', err.message);
    }
});