import jwt from 'jsonwebtoken';

export const identifyUser = (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log(authHeader);
    // console.log(req);
    // console.log(req.headers);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.split(' ')[1];

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