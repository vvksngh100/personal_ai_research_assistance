import express from 'express';
import { identifyUser } from '../middleware/identifyUser.js';
import { heavyOperationLimiter } from '../config/rateLimiter.js';
import { uploadPdf } from '../middleware/uploadMiddleware.js';
import { deleteDocument, uploadDocument } from '../controllers/uploadController.js';

const router = express.Router();

router.post(
    '/',
    identifyUser,
    heavyOperationLimiter,
    uploadPdf,
    uploadDocument
);
router.delete('/:id', identifyUser, deleteDocument);

export default router;