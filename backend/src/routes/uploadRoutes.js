import express from 'express';
import { upload } from '../config/multer.js';
import { identifyUser } from '../middleware/identifyUser.js';
import { heavyOperationLimiter } from '../config/rateLimiter.js';
import { uploadDocument } from '../controllers/uploadController.js';

const router = express.Router();

const handleMulterUpload = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err) {
            if (err.message === 'Only PDF files are allowed.') {
                return res.status(400).json({ error: err.message });
            }
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'File size exceeds 10MB limit' });
            }
            return res.status(400).json({ error: err.message || 'File upload error' });
        }
        next();
    });
};

router.post(
    '/',
    identifyUser,
    heavyOperationLimiter,
    handleMulterUpload,
    uploadDocument
);

export default router;