// backend/src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const prisma = require('../../prisma/client');

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    console.log('GET /me - User from token:', req.user);
    
    // ✅ Use userId from the token payload
    const userId = req.user.userId || req.user.id;
    
    console.log('GET /me - Looking up user with ID:', userId);
    
    if (!userId) {
      console.log('❌ GET /me - No user ID found in token');
      return res.status(401).json({ error: 'Invalid token - no user ID' });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: parseInt(userId), // ✅ Make sure it's an integer
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      console.log('❌ GET /me - User not found with ID:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ GET /me - User found:', user);
    res.json({ user });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { name, email } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token - no user ID' });
    }

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: email,
          NOT: {
            id: parseInt(userId)
          }
        }
      });

      if (existingUser) {
        return res.status(400).json({ error: 'Email already taken' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: parseInt(userId),
      },
      data: {
        ...(name && { name }),
        ...(email && { email }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({ user: updatedUser });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change password
router.put('/change-password', requireAuth, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token - no user ID' });
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: {
        id: true,
        password: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const bcrypt = require('bcryptjs');
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);

    if (!isValidPassword) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { password: hashedPassword },
    });

    res.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;