const authService = require('../services/authService');
const jwt = require('../utils/jwt');

const register = async (req, res) => {
    try{
        const {token, user} = await authService.registerUser(req.body);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 60 * 60 * 1000 
        });
        res.status(201).json({ user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const login = async (req, res) => {
    try{
        const {token, user} = await authService.loginUser(req.body);
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 60 * 60 * 1000 
        });
        res.status(200).json({ user });
    
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

const logout = (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,      
    sameSite: "lax",
  });

  res.status(200).json({ message: "Logged out successfully" });
};

module.exports = {
    register,
    login,
    logout  
};

