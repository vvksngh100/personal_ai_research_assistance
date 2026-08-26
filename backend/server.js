import express from 'express';
import { configDotenv } from 'dotenv';
import bodyParser from 'body-parser';
import { query } from './src/config/db.js';

configDotenv();

const PORT = process.env.PORT;

const app = express();

app.use(bodyParser.json());

app.get('/', (req,res) => {
    res.send('Hello World');
});

app.listen(PORT, async () => {
    console.log(`Server is started at port ${PORT}`);

    try {
        const result = await query('SELECT NOW()');
        console.log('Database is connected at: ', result.rows[0].now);
    } catch (err) {
        console.error('Database connection failed: ', err.message);
    }
});