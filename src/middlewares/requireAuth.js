const jwt = require('../utils/jwt');

const requireAuth = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Authentication token is required' });
    }

    try {
        const decoded = jwt.verifyToken(token);
        req.user = decoded; 
        console.log("Decoded JWT:", decoded);

        next(); 
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

module.exports = requireAuth;