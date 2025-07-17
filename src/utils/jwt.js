const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
console.log("JWT_SECRET loaded:", JWT_SECRET); 
const generateToken = (user) => {
    const payload = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    console.log("Generated Token:", token); 
    return token;
};

const verifyToken = (token) => {
    try {
        console.log("Verifying Token:", token); 
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log("Decoded Payload:", decoded); 
        return decoded;
    } catch (error) {
        console.error("JWT Verification Failed:", error.message); 
        throw new Error('Invalid or expired token');
    }
};

module.exports = {
    generateToken,
    verifyToken
};
