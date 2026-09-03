import express from 'express';
import { generateGuestId, register, login, forgotPassword } from '../controllers/authController.js';

const router = express.Router();

router.get('/guest-id', generateGuestId);
router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);

export default router;