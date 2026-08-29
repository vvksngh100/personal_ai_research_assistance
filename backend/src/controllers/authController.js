import { v4 as uuid4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { configDotenv } from 'dotenv';

configDotenv();

// Generate guest id
export const generateGuestId = (req, res) => {
    try {
        const guestId = uuid4();
        const payload = {guest_id: guestId};
        const secretKey = process.env.JWT_SECRET;
        const expiresIn = process.env.GUEST_JWT_EXPIRES || '24h';
        const token = jwt.sign(payload, secretKey, { expiresIn });
        res.status(200).json({ guestToken: token, token, guest_id: guestId });
    } catch (err) {
        console.error('Error generating guest ID: ', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}