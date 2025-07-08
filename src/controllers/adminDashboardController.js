const prisma = require('../../prisma/client');

const getDashboardSummary = async (req, res) => {
  try {
    const totalUsers = await prisma.user.count({
      where: { role: 'USER' },
    });

    const totalAdmins = await prisma.user.count({
      where: { role: 'ADMIN' },
    });

    const totalCategories = await prisma.category.count({
      where: { isDeleted: false },
    });

    const totalCourses = await prisma.course.count({
      where: { isDeleted: false },
    });

    const totalEnrollments = await prisma.enrollment.count();

    res.status(200).json({
      totalUsers,
      totalAdmins,
      totalCategories,
      totalCourses,
      totalEnrollments,
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
};

module.exports = {
  getDashboardSummary,
};
