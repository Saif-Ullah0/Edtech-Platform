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
          // ✅ FIXED: Use correct schema relations
          moduleItems: {
            include: {
              module: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  price: true,
                  isFree: true,
                  course: {
                    select: {
                      id: true,
                      title: true,
                      category: { select: { name: true } }
                    }
                  }
                }
              }
            }
          },
          courseItems: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  price: true,
                  isPaid: true,
                  category: { select: { name: true } }
                }
              }
            }
          },
          _count: {
            select: {
              moduleItems: true,
              courseItems: true,
              purchases: true
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
          moduleItems: {
            include: {
              module: {
                select: { 
                  id: true, 
                  title: true, 
                  description: true, 
                  price: true, 
                  isFree: true,
                  course: {
                    select: {
                      title: true,
                      category: { select: { name: true } }
                    }
                  }
                }
              }
            }
          },
          courseItems: {
            include: {
              course: {
                select: { 
                  id: true, 
                  title: true, 
                  description: true, 
                  price: true, 
                  isPaid: true,
                  category: { select: { name: true } }
                }
              }
            }
          },
          _count: {
            select: {
              moduleItems: true,
              courseItems: true,
              purchases: true
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

  // Get marketplace bundles with filtering
  static async getMarketplaceBundles(filters = {}) {
    try {
      const { type, category, minPrice, maxPrice, featured, popular } = filters;
      
      let whereClause = {
        isPublic: true,
        isActive: true
      };

      // Apply filters
      if (type && type !== 'all') {
        whereClause.type = type.toUpperCase();
      }

      if (featured) {
        whereClause.isFeatured = true;
      }

      if (popular) {
        whereClause.isPopular = true;
      }

      if (minPrice !== undefined || maxPrice !== undefined) {
        whereClause.finalPrice = {};
        if (minPrice !== undefined) whereClause.finalPrice.gte = parseFloat(minPrice);
        if (maxPrice !== undefined) whereClause.finalPrice.lte = parseFloat(maxPrice);
      }

      return await prisma.bundle.findMany({
        where: whereClause,
        include: {
          user: {
            select: { id: true, name: true, role: true }
          },
          moduleItems: {
            include: {
              module: {
                select: { 
                  id: true, 
                  title: true, 
                  price: true, 
                  isFree: true,
                  course: {
                    select: {
                      category: { select: { name: true } }
                    }
                  }
                }
              }
            }
          },
          courseItems: {
            include: {
              course: {
                select: { 
                  id: true, 
                  title: true, 
                  price: true, 
                  isPaid: true,
                  category: { select: { name: true } }
                }
              }
            }
          }
        },
        orderBy: [
          { isFeatured: 'desc' },
          { isPopular: 'desc' },
          { salesCount: 'desc' },
          { viewCount: 'desc' }
        ]
      });

    } catch (error) {
      console.error('getMarketplaceBundles error:', error);
      throw error;
    }
  }

  // Get bundle details by ID
  static async getBundleById(bundleId, userId = null) {
    try {
      const bundle = await prisma.bundle.findUnique({
        where: { id: parseInt(bundleId) },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true }
          },
          moduleItems: {
            include: {
              module: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  price: true,
                  isFree: true,
                  course: {
                    select: {
                      id: true,
                      title: true,
                      imageUrl: true,
                      category: { select: { name: true } }
                    }
                  },
                  chapters: {
                    select: {
                      id: true,
                      title: true,
                      type: true,
                      duration: true
                    }
                  }
                }
              }
            }
          },
          courseItems: {
            include: {
              course: {
                select: {
                  id: true,
                  title: true,
                  description: true,
                  price: true,
                  isPaid: true,
                  imageUrl: true,
                  category: { select: { name: true } },
                  modules: {
                    select: {
                      id: true,
                      title: true,
                      chapters: {
                        select: {
                          id: true,
                          title: true,
                          type: true,
                          duration: true
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          purchases: {
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: { id: true, name: true }
              }
            }
          }
        }
      });

      if (!bundle) {
        throw new Error('Bundle not found');
      }

      // Check ownership and purchase status
      let isPurchased = false;
      let userOwnsItems = false;

      if (userId) {
        // Check if user purchased this bundle
        const purchase = await prisma.bundlePurchase.findFirst({
          where: {
            bundleId: bundle.id,
            userId: userId
          }
        });
        isPurchased = !!purchase;

        // Check if user owns individual items
        if (!isPurchased) {
          if (bundle.type === 'COURSE' && bundle.courseItems.length > 0) {
            const courseIds = bundle.courseItems.map(item => item.course.id);
            const enrollments = await prisma.enrollment.findMany({
              where: {
                userId: userId,
                courseId: { in: courseIds }
              }
            });
            userOwnsItems = enrollments.length > 0;
          } else if (bundle.type === 'MODULE' && bundle.moduleItems.length > 0) {
            const moduleIds = bundle.moduleItems.map(item => item.module.id);
            const moduleEnrollments = await prisma.moduleEnrollment.findMany({
              where: {
                userId: userId,
                moduleId: { in: moduleIds }
              }
            });
            userOwnsItems = moduleEnrollments.length > 0;
          }
        }
      }

      // Calculate bundle metrics
      let individualTotal = 0;
      let totalItems = 0;

      if (bundle.type === 'COURSE') {
        totalItems = bundle.courseItems.length;
        individualTotal = bundle.courseItems.reduce((sum, item) => {
          return sum + (item.course.isPaid ? item.course.price : 0);
        }, 0);
      } else {
        totalItems = bundle.moduleItems.length;
        individualTotal = bundle.moduleItems.reduce((sum, item) => {
          return sum + (!item.module.isFree ? item.module.price : 0);
        }, 0);
      }

      const savings = individualTotal - bundle.finalPrice;
      const savingsPercentage = individualTotal > 0 ? Math.round((savings / individualTotal) * 100) : 0;

      return {
        ...bundle,
        totalItems,
        individualTotal,
        savings,
        savingsPercentage,
        isPurchased,
        userOwnsItems,
        recentPurchases: bundle.purchases
      };

    } catch (error) {
      console.error('getBundleById error:', error);
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
        where: { id: parseInt(bundleId) },
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

      const [
        bundleTypeStats,
        totalBundles,
        activeBundles,
        publicBundles,
        featuredBundles,
        popularBundles,
        totalSales,
        totalRevenue
      ] = await Promise.all([
        prisma.bundle.groupBy({
          by: ['type'],
          _count: { id: true },
          _sum: {
            salesCount: true,
            revenue: true,
            viewCount: true
          }
        }),
        prisma.bundle.count(),
        prisma.bundle.count({ where: { isActive: true } }),
        prisma.bundle.count({ where: { isPublic: true } }),
        prisma.bundle.count({ where: { isFeatured: true } }),
        prisma.bundle.count({ where: { isPopular: true } }),
        prisma.bundlePurchase.count(),
        prisma.bundlePurchase.aggregate({
          _sum: { finalPrice: true }
        })
      ]);

      return {
        overview: {
          totalBundles,
          activeBundles,
          publicBundles,
          featuredBundles,
          popularBundles,
          totalSales,
          totalRevenue: totalRevenue._sum.finalPrice || 0
        },
        bundleTypeStats
      };

    } catch (error) {
      console.error('getBundleAnalytics error:', error);
      throw error;
    }
  }

  // Purchase bundle
  static async purchaseBundle(bundleId, userId) {
    try {
      const bundle = await this.getBundleById(bundleId, userId);
      
      if (!bundle) {
        throw new Error('Bundle not found');
      }

      if (!bundle.isActive) {
        throw new Error('Bundle is not available for purchase');
      }

      if (bundle.isPurchased) {
        throw new Error('You have already purchased this bundle');
      }

      if (bundle.userOwnsItems) {
        throw new Error('You already own some items in this bundle');
      }

      // Process purchase in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create purchase record
        const purchase = await tx.bundlePurchase.create({
          data: {
            bundleId: bundle.id,
            userId: userId,
            purchasePrice: bundle.totalPrice,
            discount: bundle.discount,
            finalPrice: bundle.finalPrice,
            bundleType: bundle.type,
            itemCount: bundle.totalItems
          }
        });

        // Enroll user in bundle items
        if (bundle.type === 'COURSE') {
          const enrollmentData = bundle.courseItems.map(item => ({
            userId: userId,
            courseId: item.course.id,
            paymentTransactionId: `bundle_${bundle.id}_${Date.now()}`
          }));

          await tx.enrollment.createMany({
            data: enrollmentData,
            skipDuplicates: true
          });
        } else {
          const moduleEnrollmentData = bundle.moduleItems.map(item => ({
            userId: userId,
            moduleId: item.module.id,
            purchasePrice: item.module.price,
            paymentTransactionId: `bundle_${bundle.id}_${Date.now()}`
          }));

          await tx.moduleEnrollment.createMany({
            data: moduleEnrollmentData,
            skipDuplicates: true
          });
        }

        // Update bundle analytics
        await tx.bundle.update({
          where: { id: bundle.id },
          data: {
            salesCount: { increment: 1 },
            revenue: { increment: bundle.finalPrice }
          }
        });

        return purchase;
      });

      return result;

    } catch (error) {
      console.error('purchaseBundle error:', error);
      throw error;
    }
  }

  // Delete bundle
  static async deleteBundle(bundleId, userId) {
    try {
      const bundle = await prisma.bundle.findUnique({
        where: { id: parseInt(bundleId) },
        select: { 
          id: true, 
          userId: true, 
          salesCount: true, 
          name: true, 
          type: true,
          user: { select: { role: true } }
        }
      });

      if (!bundle) {
        throw new Error('Bundle not found');
      }

      // Check ownership or admin permission
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true }
      });

      const isOwner = bundle.userId === userId;
      const isAdmin = this.isUserAdmin(user);

      if (!isOwner && !isAdmin) {
        throw new Error('You can only delete your own bundles');
      }

      // Prevent deletion if bundle has sales (unless admin forces)
      if (bundle.salesCount > 0 && !isAdmin) {
        throw new Error(`Cannot delete bundle with ${bundle.salesCount} sales`);
      }

      // Delete bundle and related items
      await prisma.$transaction(async (tx) => {
        if (bundle.type === 'COURSE') {
          await tx.courseBundleItem.deleteMany({
            where: { bundleId: bundle.id }
          });
        } else {
          await tx.bundleItem.deleteMany({
            where: { bundleId: bundle.id }
          });
        }

        // If admin deleting bundle with sales, remove purchase records
        if (bundle.salesCount > 0 && isAdmin) {
          await tx.bundlePurchase.deleteMany({
            where: { bundleId: bundle.id }
          });
        }

        await tx.bundle.delete({
          where: { id: bundle.id }
        });
      });

      return { success: true, message: 'Bundle deleted successfully' };

    } catch (error) {
      console.error('deleteBundle error:', error);
      throw error;
    }
  }
}

module.exports = BundleService;