// src/controllers/adminDashboardController.js - FRONTEND COMPATIBLE VERSION
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to handle currency calculations properly
function addCurrency(amount1, amount2) {
  const cents1 = Math.round((amount1 || 0) * 100);
  const cents2 = Math.round((amount2 || 0) * 100);
  const totalCents = cents1 + cents2;
  return totalCents / 100;
}

const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 ADMIN: Fetching dashboard stats...');
    
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
              price: true,
              title: true
            }
          }
        }
      })
    ]);

    // Calculate total revenue using proper currency math
    let totalRevenue = 0;
    console.log('💰 ADMIN: Calculating revenue from enrollments...');
    
    enrollmentsWithRevenue.forEach((enrollment, index) => {
      const coursePrice = enrollment.course?.price || 0;
      const oldTotal = totalRevenue;
      
      totalRevenue = addCurrency(totalRevenue, coursePrice);
      
      console.log(`  ${index + 1}. Course: ${enrollment.course?.title || 'Unknown'}`);
      console.log(`     Price: $${coursePrice.toFixed(2)}`);
      console.log(`     Running total: $${oldTotal.toFixed(2)} + $${coursePrice.toFixed(2)} = $${totalRevenue.toFixed(2)}`);
    });

    console.log(`✅ ADMIN: Final calculated revenue: $${totalRevenue.toFixed(2)}`);

    // Calculate growth metrics
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [newUsersThisMonth, newEnrollmentsThisMonth] = await Promise.all([
      prisma.user.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      }),
      prisma.enrollment.count({
        where: { createdAt: { gte: thirtyDaysAgo } }
      })
    ]);

    // IMPORTANT: Match the exact structure your frontend expects
    const dashboardData = {
      // Basic stats that frontend expects
      totalUsers: totalUsers || 0,
      totalCourses: totalCourses || 0,
      totalEnrollments: totalEnrollments || 0,
      totalRevenue: Math.round(totalRevenue * 100) / 100, // Round to 2 decimal places, ensure it's a number
      
      // Additional detailed stats (if your frontend uses these)
      overview: {
        totalUsers: totalUsers || 0,
        totalCourses: totalCourses || 0,
        totalEnrollments: totalEnrollments || 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalRevenueFormatted: `$${totalRevenue.toFixed(2)}`
      },
      
      // Growth metrics
      growth: {
        newUsersThisMonth: newUsersThisMonth || 0,
        newEnrollmentsThisMonth: newEnrollmentsThisMonth || 0,
        userGrowthRate: totalUsers > 0 ? Math.round(((newUsersThisMonth / totalUsers) * 100) * 10) / 10 : 0,
        enrollmentGrowthRate: totalEnrollments > 0 ? Math.round(((newEnrollmentsThisMonth / totalEnrollments) * 100) * 10) / 10 : 0
      },
      
      // Recent enrollments with safe data
      recentEnrollments: recentEnrollments.map(enrollment => ({
        id: enrollment.id || 0,
        user: {
          id: enrollment.user?.id || 0,
          name: enrollment.user?.name || 'Unknown User',
          email: enrollment.user?.email || 'unknown@example.com'
        },
        course: {
          id: enrollment.course?.id || 0,
          title: enrollment.course?.title || 'Unknown Course',
          price: enrollment.course?.price || 0
        },
        createdAt: enrollment.createdAt ? enrollment.createdAt.toISOString() : new Date().toISOString()
      }))
    };

    console.log('✅ ADMIN: Dashboard stats calculated successfully');
    console.log(`✅ ADMIN: Final response totalRevenue: ${dashboardData.totalRevenue}`);
    
    res.json(dashboardData);
    
  } catch (error) {
    console.error('❌ ADMIN: Error fetching dashboard stats:', error);
    
    // Return safe fallback data to prevent frontend crashes
    res.status(200).json({
      totalUsers: 0,
      totalCourses: 0,
      totalEnrollments: 0,
      totalRevenue: 0,
      overview: {
        totalUsers: 0,
        totalCourses: 0,
        totalEnrollments: 0,
        totalRevenue: 0,
        totalRevenueFormatted: '$0.00'
      },
      growth: {
        newUsersThisMonth: 0,
        newEnrollmentsThisMonth: 0,
        userGrowthRate: 0,
        enrollmentGrowthRate: 0
      },
      recentEnrollments: [],
      error: 'Failed to fetch dashboard data'
    });
  }
};

// Additional dashboard endpoints for more detailed stats
const getUserGrowthStats = async (req, res) => {
  try {
    console.log('📈 ADMIN: Fetching user growth stats...');
    
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

    const formattedGrowth = userGrowth.map(item => ({
      date: item.createdAt.toISOString().split('T')[0],
      count: item._count.id || 0,
      formattedDate: item.createdAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      })
    }));

    res.json(formattedGrowth);
  } catch (error) {
    console.error('❌ ADMIN: Error fetching user growth stats:', error);
    res.status(200).json([]); // Return empty array instead of error
  }
};

const getCourseStats = async (req, res) => {
  try {
    console.log('📚 ADMIN: Fetching course stats...');
    
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
      take: 10
    });

    const enrichedStats = courseStats.map(course => {
      const totalRevenue = (course.price || 0) * (course._count.enrollments || 0);
      return {
        id: course.id || 0,
        title: course.title || 'Unknown Course',
        price: course.price || 0,
        enrollmentCount: course._count.enrollments || 0,
        moduleCount: course._count.modules || 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100
      };
    });

    res.json(enrichedStats);
  } catch (error) {
    console.error('❌ ADMIN: Error fetching course stats:', error);
    res.status(200).json([]); // Return empty array instead of error
  }
};

const getRevenueStats = async (req, res) => {
  try {
    console.log('💰 ADMIN: Fetching detailed revenue stats...');
    
    const revenueData = await prisma.enrollment.groupBy({
      by: ['courseId'],
      _count: {
        id: true
      }
    });

    const revenueBreakdown = await Promise.all(
      revenueData.map(async (item) => {
        const course = await prisma.course.findUnique({
          where: { id: item.courseId },
          select: { title: true, price: true }
        });
        
        const totalRevenue = (course?.price || 0) * (item._count.id || 0);
        
        return {
          courseId: item.courseId || 0,
          courseName: course?.title || 'Unknown',
          enrollmentCount: item._count.id || 0,
          coursePrice: course?.price || 0,
          totalRevenue: Math.round(totalRevenue * 100) / 100
        };
      })
    );

    revenueBreakdown.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const totalRevenueSum = revenueBreakdown.reduce((sum, item) => 
      addCurrency(sum, item.totalRevenue), 0
    );

    res.json({
      courses: revenueBreakdown,
      summary: {
        totalRevenue: Math.round(totalRevenueSum * 100) / 100,
        courseCount: revenueBreakdown.length || 0,
        averageRevenuePerCourse: revenueBreakdown.length > 0 ? 
          Math.round((totalRevenueSum / revenueBreakdown.length) * 100) / 100 : 0
      }
    });
  } catch (error) {
    console.error('❌ ADMIN: Error fetching revenue stats:', error);
    res.status(200).json({
      courses: [],
      summary: {
        totalRevenue: 0,
        courseCount: 0,
        averageRevenuePerCourse: 0
      }
    });
  }
};

module.exports = {
  getDashboardStats,
  getUserGrowthStats,
  getCourseStats,
  getRevenueStats
};