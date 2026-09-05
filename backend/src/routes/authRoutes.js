import express from 'express';
import { generateGuestId, register, login, forgotPassword, verifyOtp, resetPassword, updatePassword, profile } from '../controllers/authController.js';
import { identifyUser } from '../middleware/identifyUser.js';
import { authLimiter } from '../config/rateLimiter.js';

const router = express.Router();

router.get('/guest-id', generateGuestId);
router.post('/register', register);
router.post('/login', authLimiter, login);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/update-password', identifyUser, updatePassword);
router.get('/me', identifyUser, profile);

export default router;