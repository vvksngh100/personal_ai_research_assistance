import multer from 'multer';
import { upload } from '../config/multer.js';

/**
 * Middleware factory to handle single file uploads with Multer
 * and intercept Multer errors gracefully before reaching controllers.
 * 
 * @param {string} fieldName - Form field name (default: 'file')
 */
export const handleSingleUpload = (fieldName = 'file') => {
    const uploader = upload.single(fieldName);

    return (req, res, next) => {
        uploader(req, res, (err) => {
            if (err) {
                // Multer-specific error codes (e.g. LIMIT_FILE_SIZE)
                if (err instanceof multer.MulterError) {
                    if (err.code === 'LIMIT_FILE_SIZE') {
                        return res.status(400).json({ error: 'File size exceeds the 10MB limit' });
                    }
                    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                        return res.status(400).json({ error: `Unexpected field. Expected file under field name: "${fieldName}"` });
                    }
                    return res.status(400).json({ error: `Upload error: ${err.message}` });
                }

                // Custom errors from fileFilter (e.g. invalid MIME type)
                if (err.message === 'Only PDF files are allowed.') {
                    return res.status(400).json({ error: err.message });
                }

                return res.status(400).json({ error: err.message || 'File upload error' });
            }

            next();
        });
    };
};

/**
 * Pre-configured middleware for single PDF upload on the 'file' field
 */
export const uploadPdf = handleSingleUpload('file');
