// backend/src/services/bundleService.js - FIXED VERSION
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class BundleService {
  
  // ================================
  // BUNDLE CREATION SERVICES
  // ================================
  
  async createModuleBundle(userId, bundleData) {
    const { name, description, moduleIds, discount = 0 } = bundleData;
    
    try {
      // Validate modules exist and get pricing
      const modules = await prisma.module.findMany({
        where: { 
          id: { in: moduleIds },
          isPublished: true 
        },
        include: {
          course: { select: { id: true, title: true } }
        }
      });

      if (modules.length !== moduleIds.length) {
        throw new Error('Some modules not found or not published');
      }

      // Calculate pricing
      const totalPrice = modules.reduce((sum, module) => sum + module.price, 0);
      const discountAmount = (totalPrice * discount) / 100;
      const finalPrice = totalPrice - discountAmount;

      // Create bundle with transaction
      const bundle = await prisma.$transaction(async (tx) => {
        const newBundle = await tx.bundle.create({
          data: {
            name,
            description,
            userId,
            type: 'MODULE',
            totalPrice,
            discount,
            finalPrice,
            isActive: true
          }
        });

        // ✅ FIXED: Use model name (bundleItem) not table name (bundle_items)
        await tx.bundleItem.createMany({
          data: moduleIds.map(moduleId => ({
            bundleId: newBundle.id,
            moduleId
          }))
        });

        return newBundle;
      });

      // Return complete bundle with items
      return await this.getBundleById(bundle.id);
      
    } catch (error) {
      console.error('Error creating module bundle:', error);
      throw error;
    }
  }

  async createCourseBundle(userId, bundleData) {
    const { name, description, courseIds, discount = 0 } = bundleData;
    
    try {
      // Validate courses exist and get pricing
      const courses = await prisma.course.findMany({
        where: { 
          id: { in: courseIds },
          publishStatus: 'PUBLISHED' 
        }
      });

      if (courses.length !== courseIds.length) {
        throw new Error('Some courses not found or not published');
      }

      // Calculate pricing
      const totalPrice = courses.reduce((sum, course) => sum + course.price, 0);
      const discountAmount = (totalPrice * discount) / 100;
      const finalPrice = totalPrice - discountAmount;

      // Create bundle with transaction
      const bundle = await prisma.$transaction(async (tx) => {
        const newBundle = await tx.bundle.create({
          data: {
            name,
            description,
            userId,
            type: 'COURSE',
            totalPrice,
            discount,
            finalPrice,
            isActive: true
          }
        });

        // ✅ FIXED: Use model name (courseBundleItem) not table name (course_bundle_items)
        await tx.courseBundleItem.createMany({
          data: courseIds.map(courseId => ({
            bundleId: newBundle.id,
            courseId
          }))
        });

        return newBundle;
      });

      // Return complete bundle with items
      return await this.getBundleById(bundle.id);
      
    } catch (error) {
      console.error('Error creating course bundle:', error);
      throw error;
    }
  }

  // ================================
  // BUNDLE RETRIEVAL SERVICES
  // ================================

  async getAllBundles(filters = {}) {
    const {
      type = 'all',
      featured = false,
      popular = false,
      userId = null,
      isActive = true,
      limit = 20,
      offset = 0
    } = filters;

    const whereClause = {
      isActive,
      ...(type !== 'all' && { type: type.toUpperCase() }),
      ...(featured && { isFeatured: true }),
      ...(popular && { isPopular: true }),
      ...(userId && { userId })
    };

    try {
      const bundles = await prisma.bundle.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, email: true } },
          // ✅ FIXED: Use correct relation names from schema
          moduleItems: {
            include: {
              module: {
                include: { 
                  course: { select: { id: true, title: true } }
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
                  imageUrl: true,
                  category: { select: { name: true } }
                } 
              }
            }
          },
          _count: {
            select: { purchases: true }
          }
        },
        orderBy: [
          { isFeatured: 'desc' },
          { isPopular: 'desc' },
          { salesCount: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset
      });

      // Enhance bundles with calculated fields
      return bundles.map(bundle => this.enhanceBundleData(bundle));
      
    } catch (error) {
      console.error('Error fetching bundles:', error);
      throw error;
    }
  }

  async getBundleById(bundleId, includeAnalytics = false) {
    try {
      const bundle = await prisma.bundle.findUnique({
        where: { id: bundleId },
        include: {
          user: { select: { id: true, name: true, email: true } },
          moduleItems: {
            include: {
              module: {
                include: { 
                  course: { select: { id: true, title: true, imageUrl: true } }
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
                  imageUrl: true,
                  category: { select: { name: true } }
                } 
              }
            }
          },
          _count: {
            select: { purchases: true }
          },
          ...(includeAnalytics && {
            purchases: {
              include: {
                user: { select: { id: true, name: true, email: true } }
              },
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          })
        }
      });

      if (!bundle) {
        throw new Error('Bundle not found');
      }

      return this.enhanceBundleData(bundle);
      
    } catch (error) {
      console.error('Error fetching bundle:', error);
      throw error;
    }
  }

  async getFeaturedBundles(limit = 6) {
    try {
      const bundles = await prisma.bundle.findMany({
        where: {
          isActive: true,
          isFeatured: true,
          OR: [
            { promotedUntil: null },
            { promotedUntil: { gte: new Date() } }
          ]
        },
        include: {
          user: { select: { id: true, name: true } },
          moduleItems: {
            include: {
              module: {
                include: { course: { select: { id: true, title: true } } }
              }
            }
          },
          courseItems: {
            include: {
              course: { select: { id: true, title: true, price: true, imageUrl: true } }
            }
          },
          _count: { select: { purchases: true } }
        },
        orderBy: [
          { featuredOrder: 'asc' },
          { salesCount: 'desc' }
        ],
        take: limit
      });

      return bundles.map(bundle => this.enhanceBundleData(bundle));
      
    } catch (error) {
      console.error('Error fetching featured bundles:', error);
      throw error;
    }
  }

  async getPopularBundles(limit = 8, minSales = 1) {
    try {
      const bundles = await prisma.bundle.findMany({
        where: {
          isActive: true,
          salesCount: { gte: minSales }
        },
        include: {
          user: { select: { id: true, name: true } },
          moduleItems: {
            include: {
              module: {
                include: { course: { select: { id: true, title: true } } }
              }
            }
          },
          courseItems: {
            include: {
              course: { select: { id: true, title: true, price: true, imageUrl: true } }
            }
          },
          _count: { select: { purchases: true } }
        },
        orderBy: [
          { salesCount: 'desc' },
          { revenue: 'desc' }
        ],
        take: limit
      });

      return bundles.map(bundle => this.enhanceBundleData(bundle));
      
    } catch (error) {
      console.error('Error fetching popular bundles:', error);
      throw error;
    }
  }

  // ================================
  // BUNDLE PURCHASE SERVICES
  // ================================

  async validateBundlePurchase(bundleId, userId) {
    try {
      const bundle = await this.getBundleById(bundleId);
      
      if (!bundle.isActive) {
        throw new Error('Bundle is no longer available');
      }

      // Check for existing ownership
      if (bundle.type === 'MODULE') {
        const moduleIds = bundle.moduleItems.map(item => item.moduleId);
        const existingEnrollments = await prisma.moduleEnrollment.findMany({
          where: { userId, moduleId: { in: moduleIds } }
        });

        if (existingEnrollments.length > 0) {
          return {
            valid: false,
            error: 'You already own some modules in this bundle',
            ownedItems: existingEnrollments.map(e => e.moduleId)
          };
        }
      } else if (bundle.type === 'COURSE') {
        const courseIds = bundle.courseItems.map(item => item.courseId);
        const existingEnrollments = await prisma.enrollment.findMany({
          where: { userId, courseId: { in: courseIds } }
        });

        if (existingEnrollments.length > 0) {
          return {
            valid: false,
            error: 'You already own some courses in this bundle',
            ownedItems: existingEnrollments.map(e => e.courseId)
          };
        }
      }

      return { valid: true };
      
    } catch (error) {
      console.error('Error validating bundle purchase:', error);
      throw error;
    }
  }

  async processBundlePurchase(bundleId, userId, paymentData) {
    const { paymentTransactionId, amountPaid } = paymentData;
    
    try {
      const bundle = await this.getBundleById(bundleId);
      
      // Validate purchase
      const validation = await this.validateBundlePurchase(bundleId, userId);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      // Process purchase in transaction
      const result = await prisma.$transaction(async (tx) => {
        // ✅ FIXED: Use model name (bundlePurchase) not table name (bundle_purchases)
        const purchase = await tx.bundlePurchase.create({
          data: {
            bundleId,
            userId,
            paymentTransactionId,
            purchasePrice: bundle.totalPrice,
            discount: bundle.discount,
            finalPrice: bundle.finalPrice,
            bundleType: bundle.type,
            itemCount: bundle.type === 'MODULE' ? bundle.moduleItems.length : bundle.courseItems.length
          }
        });

        // Update bundle analytics
        await tx.bundle.update({
          where: { id: bundleId },
          data: {
            salesCount: { increment: 1 },
            revenue: { increment: bundle.finalPrice }
          }
        });

        // Enroll user in items
        if (bundle.type === 'MODULE') {
          const moduleEnrollments = bundle.moduleItems.map(item => ({
            userId,
            moduleId: item.moduleId,
            purchasePrice: bundle.finalPrice / bundle.moduleItems.length,
            paymentTransactionId,
            progress: 0,
            completed: false
          }));

          // ✅ FIXED: Use model name (moduleEnrollment) not table name (module_enrollments)
          await tx.moduleEnrollment.createMany({
            data: moduleEnrollments,
            skipDuplicates: true
          });
        } else if (bundle.type === 'COURSE') {
          const courseEnrollments = bundle.courseItems.map(item => ({
            userId,
            courseId: item.courseId,
            progress: 0.0,
            lastAccessed: new Date(),
            paymentTransactionId
          }));

          await tx.enrollment.createMany({
            data: courseEnrollments,
            skipDuplicates: true
          });
        }

        return purchase;
      });

      // Auto-update bundle popularity
      await this.updateBundlePopularity(bundleId);

      return result;
      
    } catch (error) {
      console.error('Error processing bundle purchase:', error);
      throw error;
    }
  }

  // ================================
  // ADMIN SERVICES
  // ================================

  async toggleBundleFeatured(bundleId, featuredData) {
    const { isFeatured, featuredOrder = null, promotedUntil = null } = featuredData;
    
    try {
      const updatedBundle = await prisma.bundle.update({
        where: { id: bundleId },
        data: {
          isFeatured: !!isFeatured,
          featuredOrder: isFeatured ? featuredOrder : null,
          promotedUntil: promotedUntil ? new Date(promotedUntil) : null
        }
      });

      return updatedBundle;
      
    } catch (error) {
      console.error('Error toggling bundle featured status:', error);
      throw error;
    }
  }

  async updateBundleStatus(bundleId, isActive) {
    try {
      const updatedBundle = await prisma.bundle.update({
        where: { id: bundleId },
        data: { isActive: !!isActive }
      });

      return updatedBundle;
      
    } catch (error) {
      console.error('Error updating bundle status:', error);
      throw error;
    }
  }

  async updateBundlePopularity(bundleId = null, threshold = 3) {
    try {
      if (bundleId) {
        // Update specific bundle
        const bundle = await prisma.bundle.findUnique({
          where: { id: bundleId },
          select: { salesCount: true }
        });

        if (bundle) {
          const shouldBePopular = bundle.salesCount >= threshold;
          await prisma.bundle.update({
            where: { id: bundleId },
            data: { isPopular: shouldBePopular }
          });
        }
      } else {
        // Update all bundles
        await prisma.bundle.updateMany({
          data: { isPopular: false }
        });

        await prisma.bundle.updateMany({
          where: {
            salesCount: { gte: threshold },
            isActive: true
          },
          data: { isPopular: true }
        });
      }
      
    } catch (error) {
      console.error('Error updating bundle popularity:', error);
      throw error;
    }
  }

  async getBundleAnalytics(userId = null) {
    try {
      const whereClause = userId ? { userId } : {};
      
      const [
        bundles,
        totalSales,
        totalRevenue,
        avgBundlePrice
      ] = await Promise.all([
        // Bundle data
        prisma.bundle.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            type: true,
            salesCount: true,
            revenue: true,
            viewCount: true,
            finalPrice: true,
            createdAt: true,
            _count: { select: { purchases: true } }
          }
        }),
        
        // Total sales
        prisma.bundlePurchase.count(userId ? {
          where: { bundle: { userId } }
        } : {}),
        
        // Total revenue
        prisma.bundlePurchase.aggregate({
          _sum: { finalPrice: true },
          ...(userId && {
            where: { bundle: { userId } }
          })
        }),
        
        // Average bundle price
        prisma.bundle.aggregate({
          _avg: { finalPrice: true },
          where: whereClause
        })
      ]);

      const summary = {
        totalBundles: bundles.length,
        totalSales,
        totalRevenue: totalRevenue._sum.finalPrice || 0,
        avgBundlePrice: avgBundlePrice._avg.finalPrice || 0
      };

      return { bundles, summary };
      
    } catch (error) {
      console.error('Error fetching bundle analytics:', error);
      throw error;
    }
  }

  // ================================
  // UTILITY METHODS
  // ================================

  enhanceBundleData(bundle) {
    // Calculate pricing information
    let individualTotal = 0;
    
    if (bundle.type === 'MODULE' && bundle.moduleItems) {
      individualTotal = bundle.moduleItems.reduce((sum, item) => sum + item.module.price, 0);
    } else if (bundle.type === 'COURSE' && bundle.courseItems) {
      individualTotal = bundle.courseItems.reduce((sum, item) => sum + item.course.price, 0);
    }
    
    const savings = individualTotal - bundle.finalPrice;
    const savingsPercentage = individualTotal > 0 ? ((savings / individualTotal) * 100) : 0;

    return {
      ...bundle,
      individualTotal,
      savings,
      savingsPercentage: Math.round(savingsPercentage),
      purchaseCount: bundle._count?.purchases || 0
    };
  }

  async incrementViewCount(bundleId) {
    try {
      await prisma.bundle.update({
        where: { id: bundleId },
        data: { viewCount: { increment: 1 } }
      });
    } catch (error) {
      console.error('Error incrementing view count:', error);
      // Don't throw error for view count increment
    }
  }

  async deleteBundle(bundleId, userId) {
    try {
      const bundle = await prisma.bundle.findUnique({
        where: { id: bundleId },
        include: { _count: { select: { purchases: true } } }
      });

      if (!bundle) {
        throw new Error('Bundle not found');
      }

      if (bundle.userId !== userId) {
        throw new Error('Not authorized to delete this bundle');
      }

      if (bundle._count.purchases > 0) {
        throw new Error('Cannot delete bundle with existing purchases');
      }

      await prisma.bundle.delete({
        where: { id: bundleId }
      });

      return { success: true };
      
    } catch (error) {
      console.error('Error deleting bundle:', error);
      throw error;
    }
  }
}

module.exports = new BundleService();