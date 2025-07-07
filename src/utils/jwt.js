const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
console.log("JWT_SECRET loaded:", JWT_SECRET); // ✅ Add this

const generateToken = (userId, role) => {
    const payload = { userId, role };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    console.log("Generated Token:", token); // ✅ Optional for debugging
    return token;
};

const verifyToken = (token) => {
    try {
        console.log("Verifying Token:", token); // ✅ Add this
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log("Decoded Payload:", decoded); // ✅ Add this
        return decoded;
    } catch (error) {
        console.error("JWT Verification Failed:", error.message); // ✅ Add this
        throw new Error('Invalid or expired token');
    }
};

module.exports = {
    generateToken,
    verifyToken
};
