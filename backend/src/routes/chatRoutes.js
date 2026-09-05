import express from 'express';
import { identifyUser } from '../middleware/identifyUser.js';
import {
    sendMessage,
    getChatSessions,
    getChatMessages,
    deleteChatSession,
    updateChatSession
} from '../controllers/chatController.js';

const router = express.Router();

router.post('/', identifyUser, sendMessage);
router.get('/sessions/:documentId', identifyUser, getChatSessions);
router.get('/messages/:sessionId', identifyUser, getChatMessages);
router.delete('/sessions/:sessionId', identifyUser, deleteChatSession);
router.patch('/sessions/:sessionId', identifyUser, updateChatSession);

export default router;
