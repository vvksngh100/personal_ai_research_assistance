import express from 'express';
import { generateGuestId } from '../controllers/authController.js';

const router = express.Router();

router.get('/guest-id', generateGuestId);

export default router;