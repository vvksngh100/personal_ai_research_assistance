import express from 'express';
import { identifyUser } from '../middleware/identifyUser.js';
import {
    sendMessage,
    getChatSessions,
    getChatMessages
} from '../controllers/chatController.js';

const router = express.Router();

// 1. Send chat message (supports both stream: false REST JSON & stream: true SSE)
router.post('/', identifyUser, sendMessage);

// 2. Get all chat sessions for a specific document
router.get('/sessions/:documentId', identifyUser, getChatSessions);

// 3. Get all messages for a specific chat session
router.get('/messages/:sessionId', identifyUser, getChatMessages);

export default router;
