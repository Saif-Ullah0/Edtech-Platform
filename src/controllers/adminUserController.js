// backend/controllers/userController.js
const bcrypt = require('bcrypt');
const prisma = require('../../prisma/client');

// GET /api/admin/users - Get all users
const getAllUsers = async (req, res) => {
  try {
    console.log('🔍 BACKEND Users: Fetching all users...');
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('✅ BACKEND Users: Found users:', users.length);
    res.status(200).json(users);
    
  } catch (error) {
    console.error('❌ BACKEND Users: Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// POST /api/admin/users - Create new user
const createUser = async (req, res) => {
  try {
    console.log('🔍 BACKEND Users: Creating new user...');
    console.log('🔍 BACKEND Users: Request body:', { ...req.body, password: '[HIDDEN]' });
    
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Name, email, and password are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'User with this email already exists' 
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'USER' // Default to USER if no role specified
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    console.log('✅ BACKEND Users: User created successfully:', { ...user, password: '[HIDDEN]' });
    res.status(201).json(user);
    
  } catch (error) {
    console.error('❌ BACKEND Users: Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// GET /api/admin/users/:id - Get user by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 BACKEND Users: Fetching user by ID:', id);
    
    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ BACKEND Users: User found:', user);
    res.status(200).json(user);
    
  } catch (error) {
    console.error('❌ BACKEND Users: Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// PUT /api/admin/users/:id - Update user
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body;
    
    console.log('🔍 BACKEND Users: Updating user:', id);
    console.log('🔍 BACKEND Users: Update data:', { ...req.body, password: password ? '[HIDDEN]' : undefined });

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email }
      });

      if (emailTaken) {
        return res.status(409).json({ 
          error: 'Email is already taken by another user' 
        });
      }
    }

    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;

    // Hash new password if provided
    if (password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    console.log('✅ BACKEND Users: User updated successfully:', updatedUser);
    res.status(200).json(updatedUser);
    
  } catch (error) {
    console.error('❌ BACKEND Users: Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// PUT /api/admin/users/:id/promote - Promote user to admin
const promoteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 BACKEND Users: Promoting user to admin:', id);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existingUser.role === 'ADMIN') {
      return res.status(400).json({ error: 'User is already an admin' });
    }

    // Promote user to admin
    const promotedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      }
    });

    console.log('✅ BACKEND Users: User promoted successfully:', promotedUser);
    res.status(200).json(promotedUser);
    
  } catch (error) {
    console.error('❌ BACKEND Users: Error promoting user:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
};

// DELETE /api/admin/users/:id - Delete user (optional)
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 BACKEND Users: Deleting user:', id);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow deleting the current admin (optional safety check)
    if (req.user && req.user.userId === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Delete the user
    await prisma.user.delete({
      where: { id: parseInt(id) }
    });

    console.log('✅ BACKEND Users: User deleted successfully');
    res.status(200).json({ message: 'User deleted successfully' });
    
  } catch (error) {
    console.error('❌ BACKEND Users: Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  promoteUser,
  deleteUser
};