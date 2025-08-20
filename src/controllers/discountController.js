// backend/src/controllers/discountController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 🆕 ENHANCED: Validate discount code with category/course support
const validateDiscountCode = async (req, res) => {
  try {
    const { code, purchaseAmount, itemType, itemId } = req.body;
    const userId = req.user.id;

    console.log('🔍 Validating discount:', { code, purchaseAmount, itemType, itemId, userId });

    if (!code || !purchaseAmount || !itemType || !itemId) {
      return res.status(400).json({
        success: false,
        message: 'Discount code, purchase amount, item type, and item ID are required',
      });
    }

    if (!['COURSE', 'BUNDLE', 'MODULE'].includes(itemType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item type. Must be COURSE, BUNDLE, or MODULE',
      });
    }

    const discountCode = await prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        usages: {
          where: { userId },
        },
      },
    });

    if (!discountCode) {
      return res.status(404).json({
        success: false,
        message: 'Invalid discount code',
      });
    }

    if (!discountCode.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This discount code is no longer active',
      });
    }

    // Check expiry
    if (discountCode.expiresAt && new Date() > discountCode.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This discount code has expired',
      });
    }

    // Check start date
    if (discountCode.startsAt && new Date() < discountCode.startsAt) {
      return res.status(400).json({
        success: false,
        message: 'This discount code is not yet active',
      });
    }

    // Check usage limits
    if (discountCode.maxUses && discountCode.usedCount >= discountCode.maxUses) {
      return res.status(400).json({
        success: false,
        message: 'This discount code has reached its usage limit',
      });
    }

    // Check per-user usage
    if (discountCode.maxUsesPerUser && discountCode.usages.length >= discountCode.maxUsesPerUser) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this discount code',
      });
    }

    // Check minimum purchase
    if (discountCode.minPurchaseAmount && purchaseAmount < discountCode.minPurchaseAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase amount of $${discountCode.minPurchaseAmount} required`,
      });
    }

    // 🆕 ENHANCED: Check applicability with category/course support
    if (discountCode.applicableToType !== 'ALL') {
      console.log('🔍 Checking applicability:', {
        discountType: discountCode.applicableToType,
        discountId: discountCode.applicableToId,
        requestType: itemType,
        requestId: itemId
      });

      // Direct type match (e.g., COURSE discount for COURSE purchase)
      if (discountCode.applicableToType === itemType) {
        if (discountCode.applicableToId && discountCode.applicableToId !== parseInt(itemId)) {
          return res.status(400).json({
            success: false,
            message: `This discount code is only applicable to a specific ${itemType.toLowerCase()}`,
          });
        }
      }
      // Category-specific discount for course purchase
      else if (discountCode.applicableToType === 'CATEGORY' && itemType === 'COURSE') {
        // Get the course's category
        const course = await prisma.course.findUnique({
          where: { id: parseInt(itemId) },
          select: { categoryId: true }
        });

        if (!course) {
          return res.status(400).json({
            success: false,
            message: 'Course not found',
          });
        }

        if (discountCode.applicableToId && discountCode.applicableToId !== course.categoryId) {
          return res.status(400).json({
            success: false,
            message: 'This discount code is not applicable to this course category',
          });
        }
      }
      // Other combinations not supported
      else {
        return res.status(400).json({
          success: false,
          message: `This discount code is only applicable to ${discountCode.applicableToType.toLowerCase()}s`,
        });
      }
    }

    // Calculate discount
    let discountAmount = 0;
    if (discountCode.type === 'PERCENTAGE') {
      discountAmount = (purchaseAmount * discountCode.value) / 100;
      if (discountCode.maxDiscountAmount && discountAmount > discountCode.maxDiscountAmount) {
        discountAmount = discountCode.maxDiscountAmount;
      }
    } else {
      discountAmount = Math.min(discountCode.value, purchaseAmount);
    }

    const finalAmount = Math.max(0, purchaseAmount - discountAmount);

    console.log('✅ Discount validated successfully:', {
      code: discountCode.code,
      originalAmount: purchaseAmount,
      discountAmount: Number(discountAmount.toFixed(2)),
      finalAmount: Number(finalAmount.toFixed(2))
    });

    res.json({
      success: true,
      data: {
        discountCode: {
          id: discountCode.id,
          code: discountCode.code,
          name: discountCode.name,
          type: discountCode.type,
          value: discountCode.value,
          applicableToType: discountCode.applicableToType,
          applicableToId: discountCode.applicableToId,
        },
        calculation: {
          originalAmount: purchaseAmount,
          discountAmount: Number(discountAmount.toFixed(2)),
          finalAmount: Number(finalAmount.toFixed(2)),
        },
      },
    });
  } catch (error) {
    console.error('❌ Error validating discount:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to validate discount code' : error.message,
    });
  }
};

// Apply discount code (keep existing)
const applyDiscountCode = async (req, res) => {
  try {
    const { code, originalAmount, discountAmount, finalAmount, bundleId } = req.body;
    const userId = req.user.id;
    
    const discountCode = await prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() }
    });
    
    if (!discountCode) {
      return res.status(404).json({
        success: false,
        message: 'Invalid discount code'
      });
    }
    
    // Record usage and update count
    await prisma.$transaction(async (tx) => {
      await tx.discountUsage.create({
        data: {
          discountCodeId: discountCode.id,
          userId,
          bundleId: bundleId || null,
          originalAmount,
          discountAmount,
          finalAmount
        }
      });
      
      await tx.discountCode.update({
        where: { id: discountCode.id },
        data: {
          usedCount: { increment: 1 }
        }
      });
    });
    
    res.json({
      success: true,
      message: 'Discount applied successfully'
    });
  } catch (error) {
    console.error('Error applying discount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to apply discount code'
    });
  }
};

// 🆕 ENHANCED: Create discount code with category/course support
const createDiscountCode = async (req, res) => {
  try {
    const { 
      code, 
      name, 
      description,
      type, 
      value, 
      maxUses, 
      maxUsesPerUser,
      startsAt,
      expiresAt, 
      minPurchaseAmount,
      maxDiscountAmount,
      applicableToType,
      applicableToId,
      isActive,
      isPublic
    } = req.body;
    const userId = req.user.id;
    
    console.log('🔍 Creating discount code:', req.body);
    
    if (!code || !type || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Code, type, and value are required'
      });
    }

    // Validate applicableToType
    if (applicableToType && !['ALL', 'CATEGORY', 'COURSE'].includes(applicableToType)) {
      return res.status(400).json({
        success: false,
        message: 'applicableToType must be ALL, CATEGORY, or COURSE'
      });
    }

    // Validate that if applicableToType is not ALL, applicableToId is provided
    if (applicableToType && applicableToType !== 'ALL' && !applicableToId) {
      return res.status(400).json({
        success: false,
        message: `applicableToId is required when applicableToType is ${applicableToType}`
      });
    }

    // Validate that the referenced category/course exists
    if (applicableToType === 'CATEGORY' && applicableToId) {
      const category = await prisma.category.findUnique({
        where: { id: parseInt(applicableToId) }
      });
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Referenced category does not exist'
        });
      }
    }

    if (applicableToType === 'COURSE' && applicableToId) {
      const course = await prisma.course.findUnique({
        where: { id: parseInt(applicableToId) }
      });
      if (!course) {
        return res.status(400).json({
          success: false,
          message: 'Referenced course does not exist'
        });
      }
    }
    
    const existingCode = await prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() }
    });
    
    if (existingCode) {
      return res.status(400).json({
        success: false,
        message: 'Discount code already exists'
      });
    }
    
    const discountCode = await prisma.discountCode.create({
      data: {
        code: code.toUpperCase(),
        name,
        description,
        type,
        value: parseFloat(value),
        maxUses: maxUses ? parseInt(maxUses) : null,
        maxUsesPerUser: maxUsesPerUser ? parseInt(maxUsesPerUser) : 1,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        minPurchaseAmount: minPurchaseAmount ? parseFloat(minPurchaseAmount) : 0,
        maxDiscountAmount: maxDiscountAmount ? parseFloat(maxDiscountAmount) : null,
        applicableToType: applicableToType || 'ALL',
        applicableToId: applicableToId ? parseInt(applicableToId) : null,
        isActive: isActive !== undefined ? isActive : true,
        isPublic: isPublic !== undefined ? isPublic : false,
        createdBy: userId
      }
    });
    
    console.log('✅ Discount code created successfully:', discountCode);
    
    res.status(201).json({
      success: true,
      data: discountCode,
      message: 'Discount code created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating discount:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to create discount code' : error.message
    });
  }
};

// 🆕 ENHANCED: Get discount codes with category/course details
const getDiscountCodes = async (req, res) => {
  try {
    console.log('🔍 Fetching discount codes...');
    
    const discountCodes = await prisma.discountCode.findMany({
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        usages: {
          select: { 
            id: true, 
            discountAmount: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 🆕 Enhanced: Add category/course names for display
    const enhancedDiscountCodes = await Promise.all(
      discountCodes.map(async (discount) => {
        let applicableToName = null;
        
        if (discount.applicableToType === 'CATEGORY' && discount.applicableToId) {
          const category = await prisma.category.findUnique({
            where: { id: discount.applicableToId },
            select: { name: true }
          });
          applicableToName = category?.name || 'Unknown Category';
        } else if (discount.applicableToType === 'COURSE' && discount.applicableToId) {
          const course = await prisma.course.findUnique({
            where: { id: discount.applicableToId },
            select: { title: true }
          });
          applicableToName = course?.title || 'Unknown Course';
        }

        return {
          ...discount,
          applicableToName,
          totalSavings: discount.usages.reduce((sum, usage) => sum + usage.discountAmount, 0)
        };
      })
    );
    
    console.log('✅ Found discount codes:', enhancedDiscountCodes.length);
    
    res.json({
      success: true,
      data: { discountCodes: enhancedDiscountCodes }
    });
  } catch (error) {
    console.error('❌ Error fetching discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount codes'
    });
  }
};

// 🆕 ENHANCED: Update discount code with category/course support
const updateDiscountCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      code, 
      name, 
      description,
      type, 
      value, 
      maxUses, 
      maxUsesPerUser,
      startsAt,
      expiresAt, 
      minPurchaseAmount,
      maxDiscountAmount,
      applicableToType,
      applicableToId,
      isActive, 
      isPublic 
    } = req.body;

    console.log('🔍 Updating discount code:', id, req.body);

    // Validate required fields
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid discount code ID is required',
      });
    }

    // Check if discount code exists
    const existingCode = await prisma.discountCode.findUnique({
      where: { id: parseInt(id) },
    });

    if (!existingCode) {
      return res.status(404).json({
        success: false,
        message: 'Discount code not found',
      });
    }

    // Check for duplicate code if updating the code
    if (code && code.toUpperCase() !== existingCode.code) {
      const duplicateCode = await prisma.discountCode.findUnique({
        where: { code: code.toUpperCase() },
      });
      if (duplicateCode) {
        return res.status(400).json({
          success: false,
          message: 'Another discount code with this code already exists',
        });
      }
    }

    // Validate applicableToType
    if (applicableToType && !['ALL', 'CATEGORY', 'COURSE'].includes(applicableToType)) {
      return res.status(400).json({
        success: false,
        message: 'applicableToType must be ALL, CATEGORY, or COURSE'
      });
    }

    // Validate that if applicableToType is not ALL, applicableToId is provided
    if (applicableToType && applicableToType !== 'ALL' && applicableToId === undefined) {
      return res.status(400).json({
        success: false,
        message: `applicableToId is required when applicableToType is ${applicableToType}`
      });
    }

    // Validate that the referenced category/course exists
    if (applicableToType === 'CATEGORY' && applicableToId) {
      const category = await prisma.category.findUnique({
        where: { id: parseInt(applicableToId) }
      });
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Referenced category does not exist'
        });
      }
    }

    if (applicableToType === 'COURSE' && applicableToId) {
      const course = await prisma.course.findUnique({
        where: { id: parseInt(applicableToId) }
      });
      if (!course) {
        return res.status(400).json({
          success: false,
          message: 'Referenced course does not exist'
        });
      }
    }

    // Update discount code
    const updatedCode = await prisma.discountCode.update({
      where: { id: parseInt(id) },
      data: {
        code: code ? code.toUpperCase() : existingCode.code,
        name: name !== undefined ? name : existingCode.name,
        description: description !== undefined ? description : existingCode.description,
        type: type || existingCode.type,
        value: value !== undefined ? parseFloat(value) : existingCode.value,
        maxUses: maxUses !== undefined ? (maxUses ? parseInt(maxUses) : null) : existingCode.maxUses,
        maxUsesPerUser: maxUsesPerUser !== undefined ? parseInt(maxUsesPerUser) : existingCode.maxUsesPerUser,
        startsAt: startsAt !== undefined ? (startsAt ? new Date(startsAt) : null) : existingCode.startsAt,
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : existingCode.expiresAt,
        minPurchaseAmount: minPurchaseAmount !== undefined ? parseFloat(minPurchaseAmount) : existingCode.minPurchaseAmount,
        maxDiscountAmount: maxDiscountAmount !== undefined ? (maxDiscountAmount ? parseFloat(maxDiscountAmount) : null) : existingCode.maxDiscountAmount,
        applicableToType: applicableToType || existingCode.applicableToType,
        applicableToId: applicableToId !== undefined ? (applicableToId ? parseInt(applicableToId) : null) : existingCode.applicableToId,
        isActive: isActive !== undefined ? isActive : existingCode.isActive,
        isPublic: isPublic !== undefined ? isPublic : existingCode.isPublic,
        updatedAt: new Date(),
      },
    });

    console.log('✅ Discount code updated successfully:', updatedCode);

    res.json({
      success: true,
      data: updatedCode,
      message: 'Discount code updated successfully',
    });
  } catch (error) {
    console.error('❌ Error updating discount:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to update discount code' : error.message,
    });
  }
};

// Keep existing delete function
const deleteDiscountCode = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid discount code ID is required',
      });
    }

    const discountCode = await prisma.discountCode.findUnique({
      where: { id: parseInt(id) },
    });

    if (!discountCode) {
      return res.status(404).json({
        success: false,
        message: 'Discount code not found',
      });
    }

    // Soft delete by setting isActive to false
    await prisma.discountCode.update({
      where: { id: parseInt(id) },
      data: {
        isActive: false,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Discount code deactivated successfully',
    });
  } catch (error) {
    console.error('Error deleting discount:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to delete discount code' : error.message,
    });
  }
};

// 🆕 ENHANCED: Analytics with category/course breakdown
const getDiscountAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success: false,
        message: 'Valid discount code ID is required',
      });
    }

    const discountCode = await prisma.discountCode.findUnique({
      where: { id: parseInt(id) },
      include: {
        usages: {
          select: {
            userId: true,
            orderId: true,
            originalAmount: true,
            discountAmount: true,
            finalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' }
        },
      },
    });

    if (!discountCode) {
      return res.status(404).json({
        success: false,
        message: 'Discount code not found',
      });
    }

    const totalDiscountAmount = discountCode.usages.reduce((sum, usage) => sum + usage.discountAmount, 0);
    const totalOriginalAmount = discountCode.usages.reduce((sum, usage) => sum + usage.originalAmount, 0);

    // Get applicable item name
    let applicableToName = 'All Items';
    if (discountCode.applicableToType === 'CATEGORY' && discountCode.applicableToId) {
      const category = await prisma.category.findUnique({
        where: { id: discountCode.applicableToId },
        select: { name: true }
      });
      applicableToName = category?.name || 'Unknown Category';
    } else if (discountCode.applicableToType === 'COURSE' && discountCode.applicableToId) {
      const course = await prisma.course.findUnique({
        where: { id: discountCode.applicableToId },
        select: { title: true }
      });
      applicableToName = course?.title || 'Unknown Course';
    }

    res.json({
      success: true,
      data: {
        id: discountCode.id,
        code: discountCode.code,
        name: discountCode.name,
        applicableToType: discountCode.applicableToType,
        applicableToName,
        totalUsages: discountCode.usedCount,
        totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
        totalOriginalAmount: Number(totalOriginalAmount.toFixed(2)),
        averageDiscountPerUsage: discountCode.usedCount > 0 ? Number((totalDiscountAmount / discountCode.usedCount).toFixed(2)) : 0,
        usageDetails: discountCode.usages,
        isActive: discountCode.isActive,
        expiresAt: discountCode.expiresAt,
        maxUses: discountCode.maxUses,
        remainingUses: discountCode.maxUses ? discountCode.maxUses - discountCode.usedCount : null
      },
    });
  } catch (error) {
    console.error('Error fetching discount analytics:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to fetch discount analytics' : error.message,
    });
  }
};

// 🆕 NEW: Get general analytics for all discounts
const getGeneralAnalytics = async (req, res) => {
  try {
    console.log('🔍 Fetching general discount analytics...');
    
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalCodes,
      activeCodes, 
      totalUsages,
      totalSavings,
      expiringSoon,
      recentUsages
    ] = await Promise.all([
      // Total discount codes
      prisma.discountCode.count(),
      
      // Active discount codes
      prisma.discountCode.count({
        where: { isActive: true }
      }),
      
      // Total usage count
      prisma.discountUsage.count(),
      
      // Total savings amount
      prisma.discountUsage.aggregate({
        _sum: { discountAmount: true }
      }),
      
      // Codes expiring soon
      prisma.discountCode.count({
        where: {
          isActive: true,
          expiresAt: {
            gte: now,
            lte: sevenDaysFromNow
          }
        }
      }),
      
      // Recent usage activity (last 30 days)
      prisma.discountUsage.findMany({
        where: {
          createdAt: {
            gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          discountAmount: true,
          createdAt: true
        },
        orderBy: { createdAt: 'desc' }
      })
    ]);

    console.log('✅ General analytics fetched successfully');

    res.json({
      success: true,
      data: {
        totalCodes,
        activeCodes,
        totalUsages,
        totalSavings: Number((totalSavings._sum.discountAmount || 0).toFixed(2)),
        expiringSoon,
        recentActivity: {
          last30Days: recentUsages.length,
          totalSavingsLast30Days: Number(recentUsages.reduce((sum, usage) => sum + usage.discountAmount, 0).toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching general analytics:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to fetch analytics' : error.message
    });
  }
};

module.exports = {
  validateDiscountCode,
  applyDiscountCode,
  createDiscountCode,
  getDiscountCodes,
  updateDiscountCode,
  deleteDiscountCode,
  getDiscountAnalytics,
  getGeneralAnalytics, // 🆕 NEW
};