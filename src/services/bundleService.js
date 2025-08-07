// backend/src/services/bundleService.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class BundleService {
  // Helper method to check admin status
  static isUserAdmin(user) {
    return user.role === 'ADMIN';
  }

  // Get user bundles with proper role checking
  static async getUserBundles(userId, includePublic = false) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      let whereClause = {
        OR: [{ userId: userId }]
      };

      // Add public bundles if requested
      if (includePublic) {
        whereClause.OR.push({
          isPublic: true,
          isActive: true
        });
      }

      // Admins see all bundles
      if (this.isUserAdmin(user)) {
        whereClause = {}; // No restrictions for admin
      }

      return await prisma.bundle.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, name: true, role: true }
          },
          bundleModules: {
            include: {
              module: true
            }
          },
          bundleCourses: {
            include: {
              course: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

    } catch (error) {
      console.error('getUserBundles error:', error);
      throw error;
    }
  }

  // Get featured bundles for marketplace
  static async getFeaturedBundles() {
    try {
      return await prisma.bundle.findMany({
        where: {
          isPublic: true,
          isActive: true,
          isFeatured: true
        },
        include: {
          user: {
            select: { id: true, name: true, role: true }
          },
          bundleModules: {
            include: {
              module: {
                select: { id: true, name: true, description: true }
              }
            }
          },
          bundleCourses: {
            include: {
              course: {
                select: { id: true, title: true, description: true }
              }
            }
          },
          _count: {
            select: {
              bundleModules: true,
              bundleCourses: true
            }
          }
        },
        orderBy: [
          { salesCount: 'desc' },
          { viewCount: 'desc' }
        ]
      });

    } catch (error) {
      console.error('getFeaturedBundles error:', error);
      throw error;
    }
  }

  // Admin bundle management methods
  static async updateBundleStatus(bundleId, userId, statusUpdates) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
      });

      if (!user || !this.isUserAdmin(user)) {
        throw new Error('Admin access required');
      }

      return await prisma.bundle.update({
        where: { id: bundleId },
        data: statusUpdates,
        include: {
          user: {
            select: { id: true, name: true, role: true }
          }
        }
      });

    } catch (error) {
      console.error('updateBundleStatus error:', error);
      throw error;
    }
  }

  // Bundle analytics for admins
  static async getBundleAnalytics(userId) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true }
      });

      if (!user || !this.isUserAdmin(user)) {
        throw new Error('Admin access required');
      }

      const analytics = await prisma.bundle.groupBy({
        by: ['type'],
        _count: true,
        _sum: {
          salesCount: true,
          revenue: true,
          viewCount: true
        }
      });

      const totalBundles = await prisma.bundle.count();
      const activeBundles = await prisma.bundle.count({ where: { isActive: true } });
      const publicBundles = await prisma.bundle.count({ where: { isPublic: true } });

      return {
        analytics,
        summary: {
          total: totalBundles,
          active: activeBundles,
          public: publicBundles
        }
      };

    } catch (error) {
      console.error('getBundleAnalytics error:', error);
      throw error;
    }
  }
}

module.exports = BundleService;