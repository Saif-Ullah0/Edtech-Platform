const prisma = require('../../prisma/client');

// GET /api/admin/users
const getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    res.status(200).json(users);
  } catch (error) {
    console.error(' Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// PUT /api/admin/users/:id/promote
const promoteToAdmin = async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { role: 'ADMIN' }
    });

    res.status(200).json({ message: ' User promoted to admin', user: updated });
  } catch (error) {
    console.error('Error promoting user:', error);
    res.status(500).json({ error: 'Failed to promote user' });
  }
};

module.exports = {
  getAllUsers,
  promoteToAdmin
};
