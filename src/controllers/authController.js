const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma/client');
const passport = require('passport');

const generateToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  console.log('Generating token with payload:', payload);

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

  console.log('Generated Token:', token);
  return token;
};

// Register
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 360000000, // 1 hour
    });

    res.status(201).json({
      message: 'User registered successfully',
      user,
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'BANNED') {
      return res.status(403).json({ error: 'Account has been banned. Please contact support.' });
    }

    if (user.status === 'DELETED') {
      return res.status(403).json({ error: 'Account has been deactivated.' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const { password: _, ...userWithoutPassword } = user;

    const token = generateToken(userWithoutPassword);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 360000000, // 1 hour
    });

    res.json({
      message: 'Login successful',
      user: userWithoutPassword,
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Google Auth
const googleAuth = passport.authenticate('google', { scope: ['profile', 'email'] });

// Google Auth Callback
const googleAuthCallback = (req, res) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 360000000,
    });

    const redirectUrl = user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';
    res.redirect(`${process.env.FRONTEND_URL}${redirectUrl}`);
  })(req, res);
};

// Facebook Auth
const facebookAuth = passport.authenticate('facebook', { scope: ['email'] });

// Facebook Auth Callback
const facebookAuthCallback = (req, res) => {
  passport.authenticate('facebook', { session: false }, (err, user) => {
    if (err || !user) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
    }

    const token = generateToken(user);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 360000000,
    });

    const redirectUrl = user.role === 'ADMIN' ? '/admin/dashboard' : '/dashboard';
    res.redirect(`${process.env.FRONTEND_URL}${redirectUrl}`);
  })(req, res);
};

module.exports = {
  register,
  login,
  logout,
  googleAuth,
  googleAuthCallback,
  facebookAuth,
  facebookAuthCallback,
};