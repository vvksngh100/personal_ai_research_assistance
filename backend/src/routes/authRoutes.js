import express from 'express';
import { generateGuestId, register } from '../controllers/authController.js';

const router = express.Router();

router.get('/guest-id', generateGuestId);
router.post('/register', register);

export default router;