// src/controllers/adminDashboardController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getDashboardStats = async (req, res) => {
  try {
    // Get all stats in parallel for better performance
    const [
      totalUsers,
      totalCourses,
      totalEnrollments,
      recentEnrollments,
      enrollmentsWithRevenue
    ] = await Promise.all([
      // Total users count
      prisma.user.count(),
      
      // Total courses count (excluding deleted)
      prisma.course.count({
        where: { isDeleted: false }
      }),
      
      // Total enrollments count
      prisma.enrollment.count(),
      
      // Recent enrollments (last 10)
      prisma.enrollment.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
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
              title: true,
              price: true
            }
          }
        }
      }),
      
      // Get all enrollments with course prices for revenue calculation
      prisma.enrollment.findMany({
        include: {
          course: {
            select: {
              price: true
            }
          }
        }
      })
    ]);

    // Calculate total revenue (sum of all enrollment course prices)
    // Make sure we're treating prices as USD, not converting to other currency
    const totalRevenue = enrollmentsWithRevenue.reduce((total, enrollment) => {
      const coursePrice = enrollment.course.price || 0;
      
      // Log for debugging
      console.log(`Course price: ${coursePrice}, Current total: ${total}`);
      
      return total + coursePrice;
    }, 0);

    console.log(`Final calculated revenue: ${totalRevenue}`);

    const dashboardData = {
      totalUsers,
      totalCourses,
      totalEnrollments,
      totalRevenue: Math.round(totalRevenue * 100) / 100, // Round to 2 decimal places
      recentEnrollments: recentEnrollments.map(enrollment => ({
        id: enrollment.id,
        user: {
          id: enrollment.user.id,
          name: enrollment.user.name,
          email: enrollment.user.email
        },
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title
        },
        createdAt: enrollment.createdAt.toISOString()
      }))
    };

    res.json(dashboardData);
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

// Additional dashboard endpoints for more detailed stats
const getUserGrowthStats = async (req, res) => {
  try {
    // Get user registrations for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const userGrowth = await prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      },
      _count: {
        id: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    res.json(userGrowth);
  } catch (error) {
    console.error('Error fetching user growth stats:', error);
    res.status(500).json({ error: 'Failed to fetch user growth data' });
  }
};

const getCourseStats = async (req, res) => {
  try {
    // Get course stats with enrollment counts
    const courseStats = await prisma.course.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        title: true,
        price: true,
        _count: {
          select: {
            enrollments: true,
            modules: true
          }
        }
      },
      orderBy: {
        enrollments: {
          _count: 'desc'
        }
      },
      take: 10 // Top 10 courses by enrollment
    });

    res.json(courseStats);
  } catch (error) {
    console.error('Error fetching course stats:', error);
    res.status(500).json({ error: 'Failed to fetch course statistics' });
  }
};

const getRevenueStats = async (req, res) => {
  try {
    // Get revenue breakdown by course
    const revenueData = await prisma.enrollment.groupBy({
      by: ['courseId'],
      _count: {
        id: true
      },
      include: {
        course: {
          select: {
            title: true,
            price: true
          }
        }
      }
    });

    // Calculate revenue per course
    const revenueBreakdown = await Promise.all(
      revenueData.map(async (item) => {
        const course = await prisma.course.findUnique({
          where: { id: item.courseId },
          select: { title: true, price: true }
        });
        
        return {
          courseId: item.courseId,
          courseName: course?.title || 'Unknown',
          enrollmentCount: item._count.id,
          coursePrice: course?.price || 0,
          totalRevenue: (course?.price || 0) * item._count.id
        };
      })
    );

    res.json(revenueBreakdown);
  } catch (error) {
    console.error('Error fetching revenue stats:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
};

module.exports = {
  getDashboardStats,
  getUserGrowthStats,
  getCourseStats,
  getRevenueStats
};