import { rateLimit } from 'express-rate-limit';

export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {error: 'Too many requests, please try again later.'}
});

export const heavyOperationLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    keyGenerator: (req) => {
        if(req.user && req.user.id){
            return `user_${req.user.id}`;
        }  
        if(req.guest && req.guest.id){
            return `guest_${req.guest.id}`;
        }

        return req.ip;
    },
    message: {error: 'You are doing that too often. Please slow down.'}
}); 