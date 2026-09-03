import { v4 as uuid4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { configDotenv } from 'dotenv';
import validator from '../utils/validator.js';
import bcrypt from 'bcrypt';
import pool from '../config/db.js';
import { sendOtpEmail } from '../services/emailService.js';

configDotenv();

const saltRounds = 10;

// Generate guest id
export const generateGuestId = (req, res) => {
    try {
        const guestId = uuid4();
        const payload = { guest_id: guestId };
        const secretKey = process.env.JWT_SECRET;
        const expiresIn = process.env.GUEST_JWT_EXPIRES || '24h';
        const token = jwt.sign(payload, secretKey, { expiresIn });
        res.status(200).json({ status: true, token, guest_id: guestId });
    } catch (err) {
        console.error('Error generating guest ID: ', err);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
}

// Sign up
export const register = async (req, res) => {
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
        if (validationResult.fails()) {
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

        if (guestId) {
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
            { id: newUser.id, email: newUser.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES }
        );

        res.status(201).json({
            status: true,
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
        if (err.code === '23505') {
            return res.status(409).json({
                status: false,
                message: 'User with this email or username already exists'
            });
        }
        return res.status(500).json({
            status: false,
            message: 'Internal Server Error'
        });
    }
}

// Login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const validationRules = {
            email: 'required|email',
            password: 'required'
        };

        const validationResult = validator(req.body, validationRules);

        if (validationResult.fails()) {
            return res.status(409).json({
                error: 'Validation Failed',
                details: validationResult.errors.all(),
            });
        }

        const userQuery = `SELECT * FROM users where email = $1`;
        const userData = await pool.query(userQuery, [email]);
        const loggedInUser = userData.rows[0];
        if(!loggedInUser){
            return res.status(400).json({
                status: false,
                message: 'You have entered the wrong credentials.'
            });
        }
        
        const isMatched = await bcrypt.compare(password, loggedInUser.password_hash);

        if(isMatched){
            const payload = {
                id: loggedInUser.id,
                name: loggedInUser.name,
                email: loggedInUser.email,
            };

            const token = jwt.sign(payload, process.env.JWT_SECRET, {expiresIn: process.env.JWT_EXPIRES});

            return res.status(200).json({
                status: true,
                message: 'User logged in successfully!',
                token,
                user: {
                    id: loggedInUser.id,
                    email: loggedInUser.email,
                    name: loggedInUser.name,
                    username: loggedInUser.username,
                }
            });
        }

        res.status(400).json({
            status: false,
            message: 'You have enter the wrong credentials',
        });
    } catch (err) {
        console.error('[Login Error]: ', err);
        return res.status(500).json({
            status: false,
            message: 'Something went wrong',
        });
    }

}


// Forgot password
export const forgotPassword = async(req, res) => {
    try {
        const { email } = req.body;
        const validationRules = {
            email: 'required|email'
        };

        const validationResult = validator(req.body, validationRules);

        if(validationResult.fails()){
            return res.status(400).json({
                status: false,
                message: 'Validataion Failed',
                details: validationResult.errors.all()
            });
        }

        // Check for the existing otp
        const userCheck = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if(userCheck.rows.length === 0){
            return res.status(200).json({
                status: true,
                message: 'If the email exists, an OTP has been sent.'
            });
        }

        // Generate otp
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // Generate hashed otp
        const salt = await bcrypt.genSalt(saltRounds);
        const hashOtp = await bcrypt.hash(otp, salt);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await pool.query(`INSERT INTO password_resets (email, otp_hash, expires_at) VALUES ($1, $2, $3)`, [email, hashOtp, expiresAt]);

        await sendOtpEmail(email, otp);

        return res.status(200).json({
            status: true,
            message: 'If the email exists, an OTP has been sent.'
        });

    } catch (err) {
        console.error('[Forgot Password Error]: ', err);
        return res.status(500).json({
            status: false,
            message: 'Failed to send OTP'
        });
    }
}