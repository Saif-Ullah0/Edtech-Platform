// backend/controllers/adminDashboardController.js - WITH DEBUGGING
const prisma = require('../../prisma/client');

const getDashboardSummary = async (req, res) => {
  console.log('🔍 BACKEND Dashboard: getDashboardSummary called');
  console.log('🔍 BACKEND Dashboard: User from request:', req.user);
  
  try {
    console.log('🔍 BACKEND Dashboard: Starting database queries...');

    // Get total counts
    console.log('🔍 BACKEND Dashboard: Querying total users...');
    const totalUsers = await prisma.user.count();
    console.log('🔍 BACKEND Dashboard: Total users:', totalUsers);

    console.log('🔍 BACKEND Dashboard: Querying total courses...');
    const totalCourses = await prisma.course.count({
      where: { isDeleted: false },
    });
    console.log('🔍 BACKEND Dashboard: Total courses:', totalCourses);

    console.log('🔍 BACKEND Dashboard: Querying total enrollments...');
    const totalEnrollments = await prisma.enrollment.count();
    console.log('🔍 BACKEND Dashboard: Total enrollments:', totalEnrollments);

    // Get total revenue from completed orders
    console.log('🔍 BACKEND Dashboard: Querying total revenue...');
    const revenueResult = await prisma.order.aggregate({
      _sum: {
        price: true
      },
      where: {
        status: 'COMPLETED'
      }
    });
    const totalRevenue = revenueResult._sum.price || 0;
    console.log('🔍 BACKEND Dashboard: Total revenue:', totalRevenue);

    // Get recent enrollments with user and course details
    console.log('🔍 BACKEND Dashboard: Querying recent enrollments...');
    const recentEnrollments = await prisma.enrollment.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        course: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });
    console.log('🔍 BACKEND Dashboard: Recent enrollments count:', recentEnrollments.length);

    // Return data in the format frontend expects
    const dashboardData = {
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalRevenue,
      recentEnrollments
    };

    console.log('✅ BACKEND Dashboard: Dashboard data prepared:', dashboardData);
    res.status(200).json(dashboardData);

  } catch (error) {
    console.error('❌ BACKEND Dashboard: Error fetching dashboard summary:', error);
    console.error('❌ BACKEND Dashboard: Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
};

module.exports = {
  getDashboardSummary,
};