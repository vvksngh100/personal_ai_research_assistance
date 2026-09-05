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
        if (!loggedInUser) {
            return res.status(400).json({
                status: false,
                message: 'You have entered the wrong credentials.'
            });
        }

        const isMatched = await bcrypt.compare(password, loggedInUser.password_hash);

        if (isMatched) {
            const payload = {
                id: loggedInUser.id,
                name: loggedInUser.name,
                email: loggedInUser.email,
            };

            const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES });

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
            message: 'Internal server error',
        });
    }

}


// Forgot password
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const validationRules = {
            email: 'required|email'
        };

        const validationResult = validator(req.body, validationRules);

        if (validationResult.fails()) {
            return res.status(400).json({
                status: false,
                message: 'Validataion Failed',
                details: validationResult.errors.all()
            });
        }

        // Check for the existing otp
        const userCheck = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
        if (userCheck.rows.length === 0) {
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

// Verify OTP
export const verifyOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        const validationRule = {
            email: 'required|email',
            otp: 'required'
        };

        const validationResult = validator(req.body, validationRule);

        if (validationResult.fails()) {
            return res.status(400).json({
                status: false,
                message: 'Validation Failed',
                details: validationResult.errors.all()
            });
        }

        const queryResult = await pool.query(`SELECT * from password_resets WHERE email = $1 ORDER BY created_at DESC LIMIT 1`, [email]);
        const otpData = queryResult.rows[0];

        if(!otpData){
            return res.status(400).json({
                status: false,
                message: 'No OTP has been found for this email or it has expired.'
            });
        }
        if (otpData.is_used || (new Date(otpData.expires_at).getTime() < Date.now())) {
            return res.status(400).json({
                status: false,
                message: 'OTP was used or has expired.'
            });
        }

        const isMatched = await bcrypt.compare(otp, otpData.otp_hash);
        if (isMatched) {
            await pool.query(`UPDATE password_resets SET is_used = TRUE WHERE id = $1`, [otpData.id]);
            const token = jwt.sign({ email: otpData.email, purpose: 'password_reset' }, process.env.JWT_SECRET, { expiresIn: '10m' });
            return res.status(200).json({
                status: true,
                message: 'OTP verified successfully',
                token
            });
        }

        res.status(400).json({
            status: false,
            message: 'Wrong OTP',
        });
    } catch (err) {
        console.error('[OTP Veryfication Failed]: ', err);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
}


// Reset password
export const resetPassword = async(req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({
                status: false,
                message: 'Unauthorized'
            })
        }
        const token = authHeader.split(' ')[1];

        let decoded;
        try {            
            decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch (err) {
            return res.status(401).json({
                status: false,
                message: 'Unauthorized'
            });
        }
        const email = decoded.email;
        if(decoded.purpose !== 'password_reset' || !email){
            return res.status(400).json({
                status: false,
                message: 'Token Varyfication Failed'
            });
        }

        const {newPassword} = req.body;

        const validationRule = {
            newPassword: 'required'
        };

        const validationResult = validator(req.body, validationRule);

        if(validationResult.fails()){
            return res.status(400).json({
                status: false,
                message: 'Validation Failed',
                details: validationResult.errors.all()
            });
        }

        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await pool.query(`UPDATE users SET password_hash = $1, recver = COALESCE(recver, 0) + 1, updated_at = NOW() WHERE email = $2`, [hashedPassword, email]);
        await pool.query(`DELETE FROM password_resets WHERE email = $1`, [email]);

        return res.status(200).json({
            status: true,
            message: 'Password has been reset successfully. Please login.'
        })
    } catch (err) {
        console.error('[Password Reset Failed]: ',err);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
}

// Update password
export const updatePassword = async(req, res) => {
    try {
        const {oldPassword, newPassword} = req.body;
        const userId = req.user?.id;

        const validationRule = {
            oldPassword: 'required',
            newPassword: 'required'
        };
        const validationResult = validator(req.body, validationRule);
        if(validationResult.fails()){
            return res.status(400).json({
                status: false,
                message: 'Validation Failed'
            });
        }

        const queryResult = await pool.query(`SELECT * FROM users where id = $1`, [userId]);
        if(queryResult.rows.length === 0){
            return res.status(401).json({
                status: false,
                message: 'Unauthorized'
            });
        }

        const userData = queryResult.rows[0];
        const isMatched = await bcrypt.compare(oldPassword, userData.password_hash);
        if(!isMatched){
            return res.status(400).json({
                status: false,
                message: 'Incorrect Credentials'
            });
        }

        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashedPassword, userId]);

        return res.status(200).json({
            status: true,
            message: 'Password updated successfully'
        });
    } catch (err) {
        console.error('[Password Update Failed]: ', err);
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
}

// Profile
export const profile = async (req, res) => {
    try {
        const userId = req.user?.id;
        const queryResult = await pool.query(`SELECT id, name, username, email FROM users WHERE id = $1`, [userId]);
        if(queryResult.rows.length === 0){
            return res.status(401).json({
                status: false,
                message: 'Unauthorized'
            });
        }

        const user = queryResult.rows[0];

        return res.status(200).json({
            status: true,
            message: 'Profile details fetched successfully',
            user
        });
    } catch (err) {
        console.error('[Profile Error]: ', err)
        return res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
}