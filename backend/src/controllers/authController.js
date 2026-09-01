import { v4 as uuid4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { configDotenv } from 'dotenv';
import validator from '../utils/validator.js';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';

configDotenv();

const saltRounds = 10;

// Generate guest id
export const generateGuestId = (req, res) => {
    try {
        const guestId = uuid4();
        const payload = {guest_id: guestId};
        const secretKey = process.env.JWT_SECRET;
        const expiresIn = process.env.GUEST_JWT_EXPIRES || '24h';
        const token = jwt.sign(payload, secretKey, { expiresIn });
        res.status(200).json({ guestToken: token, token, guest_id: guestId });
    } catch (err) {
        console.error('Error generating guest ID: ', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

// Sign up
export const register = async(req, res) => {
    try {
        const { guestId, name, username, email, password } = req.body;

        const validationRule = {
            guestId: 'string',
            name: 'required|string|min:2',
            username: 'string|min:3|max:20',
            email: 'required|email',
            password: 'required'
        }

        const validationResult = validator(req.body, validationRule);
        if(validationResult.fails()){
            return res.status(400).json({
              error: 'Validation Failed',
              details: validationResult.errors.all(),      
            });
        }

        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);
        const signupQuery = `INSERT INTO users (name, username, email, password_hash, recver) VALUES ($1, $2, $3, $4, 0) RETURNING *`;
        const userData = await pool.query(signupQuery, [name, username || null, email, hashedPassword]);

        const newUser = userData.rows[0];

        if(guestId){
            await pool.query(
                `UPDATE documents SET user_id = $1, guest_id = NULL WHERE guest_id = $2`,
                [newUser.id, guestId]
            );
            await pool.query(
                `UPDATE chat_sessions SET user_id = $1, guest_id = NULL WHERE guest_id = $2`,
                [newUser.id, guestId]
            );
        }

        const token = jwt.sign(
            {id: newUser.id, email: newUser.email},
            process.env.JWT_SECRET,
            {expiresIn: process.env.JWT_EXPIRES}
        );

        res.status(201).json({
            message: 'User registered successfully!',
            token,
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                username: newUser.username,
            }
        })

    } catch (err) {
        console.error('[Signup Error]: ', err);
        if(err.code === '23505'){
            return res.status(409).json({
                error: 'User with this email or username already exists'
            });
        }
        return res.status(500).json({
            error: 'Internal Server Error'
        });
    }
}