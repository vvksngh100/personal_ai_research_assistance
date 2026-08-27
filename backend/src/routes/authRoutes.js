import express from 'express';
import { generateGuestId } from '../controllers/authController';

const router = express.Router();

router.get('/guest-id', generateGuestId);

export default router;