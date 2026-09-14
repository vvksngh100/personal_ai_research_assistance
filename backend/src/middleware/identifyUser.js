import jwt from 'jsonwebtoken';

export const identifyUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Authorization token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if token belongs to a registered user or a guest
        if (decoded.id || decoded.userId) {
            req.user = { id: decoded.id || decoded.userId };
        } else if (decoded.guest_id) {
            req.guest = { guest_id: decoded.guest_id, id: decoded.guest_id };
        } else {
            return res.status(401).json({ error: 'Invalid token payload' });
        }

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};