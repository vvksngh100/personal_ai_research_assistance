import express from 'express';
import { identifyUser } from '../middleware/identifyUser.js';
import { heavyOperationLimiter } from '../config/rateLimiter.js';
import { uploadPdf } from '../middleware/uploadMiddleware.js';
import { deleteDocument, getDocuments, uploadDocument, streamDocumentProgress, getDocumentStatus } from '../controllers/uploadController.js';

const router = express.Router();

router.post(
    '/',
    identifyUser,
    heavyOperationLimiter,
    uploadPdf,
    uploadDocument
);
router.get('/progress/:id', identifyUser, streamDocumentProgress);
router.get('/status/:id', identifyUser, getDocumentStatus);
router.delete('/:id', identifyUser, deleteDocument);
router.get('/', identifyUser, getDocuments);

export default router;