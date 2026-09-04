import express from 'express';
import { generateGuestId, register, login, forgotPassword, verifyOtp, resetPassword, updatePassword } from '../controllers/authController.js';
import { identifyUser } from '../middleware/identifyUser.js';

const router = express.Router();

router.get('/guest-id', generateGuestId);
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/update-password', identifyUser, updatePassword);

export default router;