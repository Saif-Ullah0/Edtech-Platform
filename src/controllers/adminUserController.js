const bcrypt = require('bcrypt');
const prisma = require('../../prisma/client');

// 🆕 UPDATED: Get all users with status filtering
const getAllUsers = async (req, res) => {
  try {
    console.log('🔍 BACKEND Users: Fetching all users...');
    
    const { status } = req.query; // 🆕 Optional status filter
    
    const where = {};
    if (status) {
      where.status = status.toUpperCase();
    }
    
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,    // 🆕 Include status
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

const createUser = async (req, res) => {
  try {
    console.log('🔍 BACKEND Users: Creating new user...');
    console.log('🔍 BACKEND Users: Request body:', { ...req.body, password: '[HIDDEN]' });
    
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ 
        error: 'Name, email, and password are required' 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'User with this email already exists' 
      });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'USER',
        status: 'ACTIVE'    // 🆕 Default to active
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,       // 🆕 Include status
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
        status: true,    // 🆕 Include status
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

// 🆕 UPDATED: Enhanced update with status changes
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, status } = req.body; // 🆕 Added status
    
    console.log('🔍 BACKEND Users: Updating user:', id);
    console.log('🔍 BACKEND Users: Update data:', { ...req.body, password: password ? '[HIDDEN]' : undefined });

    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

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

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status) updateData.status = status.toUpperCase(); // 🆕 Handle status update

    if (password) {
      const saltRounds = 10;
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,    // 🆕 Include status
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

const promoteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 BACKEND Users: Promoting user to admin:', id);

    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existingUser.role === 'ADMIN') {
      return res.status(400).json({ error: 'User is already an admin' });
    }

    const promotedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role: 'ADMIN' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,    // 🆕 Include status
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

// 🆕 UPDATED: Soft delete instead of hard delete
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 BACKEND Users: Soft deleting user:', id);

    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user && req.user.userId === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // 🆕 Soft delete by updating status
    const deletedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status: 'DELETED' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    console.log('✅ BACKEND Users: User soft deleted successfully');
    res.status(200).json({ message: 'User deleted successfully', user: deletedUser });
    
  } catch (error) {
    console.error('❌ BACKEND Users: Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// 🆕 NEW: Ban user endpoint
const banUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 BACKEND Users: Banning user:', id);

    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (req.user && req.user.userId === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot ban your own account' });
    }

    if (existingUser.status === 'BANNED') {
      return res.status(400).json({ error: 'User is already banned' });
    }

    const bannedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status: 'BANNED' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    console.log('✅ BACKEND Users: User banned successfully');
    res.status(200).json({ message: 'User banned successfully', user: bannedUser });
    
  } catch (error) {
    console.error('❌ BACKEND Users: Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
};

// 🆕 NEW: Unban user endpoint
const unbanUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 BACKEND Users: Unbanning user:', id);

    const existingUser = await prisma.user.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existingUser.status !== 'BANNED') {
      return res.status(400).json({ error: 'User is not banned' });
    }

    const unbannedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    console.log('✅ BACKEND Users: User unbanned successfully');
    res.status(200).json({ message: 'User unbanned successfully', user: unbannedUser });
    
  } catch (error) {
    console.error('❌ BACKEND Users: Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
};

module.exports = {
  getAllUsers,
  createUser,
  getUserById,
  updateUser,
  promoteUser,
  deleteUser,
  banUser,        // 🆕 NEW
  unbanUser       // 🆕 NEW
};