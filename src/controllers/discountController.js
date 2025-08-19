// backend/src/controllers/discountController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Validate discount code
const validateDiscountCode = async (req, res) => {
  try {
    const { code, purchaseAmount, itemType, itemId } = req.body;
    const userId = req.user.id;

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

    // Check applicability
    if (discountCode.applicableToType !== 'ALL') {
      if (discountCode.applicableToType !== itemType) {
        return res.status(400).json({
          success: false,
          message: `This discount code is only applicable to ${discountCode.applicableToType.toLowerCase()}s`,
        });
      }
      // Optionally, check if the specific itemId is allowed (e.g., specific course or bundle)
      // This requires an additional table for specific item mappings, which we can add later if needed.
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

    res.json({
      success: true,
      data: {
        discountCode: {
          id: discountCode.id,
          code: discountCode.code,
          name: discountCode.name,
          type: discountCode.type,
          value: discountCode.value,
        },
        calculation: {
          originalAmount: purchaseAmount,
          discountAmount: Number(discountAmount.toFixed(2)),
          finalAmount: Number(finalAmount.toFixed(2)),
        },
      },
    });
  } catch (error) {
    console.error('Error validating discount:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to validate discount code' : error.message,
    });
  }
};
// Apply discount code
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

// Create discount code (Admin only)
const createDiscountCode = async (req, res) => {
  try {
    const { code, name, type, value, maxUses, expiresAt, minPurchaseAmount } = req.body;
    const userId = req.user.id;
    
    if (!code || !type || value === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Code, type, and value are required'
      });
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
        type,
        value,
        maxUses: maxUses || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        minPurchaseAmount: minPurchaseAmount || 0,
        createdBy: userId
      }
    });
    
    res.status(201).json({
      success: true,
      data: discountCode,
      message: 'Discount code created successfully'
    });
  } catch (error) {
    console.error('Error creating discount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create discount code'
    });
  }
};

// Get all discount codes (Admin only)
const getDiscountCodes = async (req, res) => {
  try {
    const discountCodes = await prisma.discountCode.findMany({
      include: {
        creator: {
          select: { id: true, name: true, email: true }
        },
        usages: {
          select: { id: true, discountAmount: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json({
      success: true,
      data: { discountCodes }
    });
  } catch (error) {
    console.error('Error fetching discounts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch discount codes'
    });
  }
};

// Update discount code (Admin only)
const updateDiscountCode = async (req, res) => {
  try {
    const { id } = req.params;
    const { code, name, type, value, maxUses, expiresAt, minPurchaseAmount, isActive, isPublic } = req.body;

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

    // Update discount code
    const updatedCode = await prisma.discountCode.update({
      where: { id: parseInt(id) },
      data: {
        code: code ? code.toUpperCase() : existingCode.code,
        name: name !== undefined ? name : existingCode.name,
        type: type || existingCode.type,
        value: value !== undefined ? value : existingCode.value,
        maxUses: maxUses !== undefined ? maxUses : existingCode.maxUses,
        expiresAt: expiresAt ? new Date(expiresAt) : existingCode.expiresAt,
        minPurchaseAmount: minPurchaseAmount !== undefined ? minPurchaseAmount : existingCode.minPurchaseAmount,
        isActive: isActive !== undefined ? isActive : existingCode.isActive,
        isPublic: isPublic !== undefined ? isPublic : existingCode.isPublic,
        updatedAt: new Date(),
      },
    });

    res.json({
      success: true,
      data: updatedCode,
      message: 'Discount code updated successfully',
    });
  } catch (error) {
    console.error('Error updating discount:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to update discount code' : error.message,
    });
  }
};


// Delete discount code (Admin only)
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

// ... other imports and functions ...

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

    res.json({
      success: true,
      data: {
        id: discountCode.id,
        code: discountCode.code,
        totalUsages: discountCode.usedCount,
        totalDiscountAmount: Number(totalDiscountAmount.toFixed(2)),
        usageDetails: discountCode.usages,
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

module.exports = {
  validateDiscountCode,
  applyDiscountCode,
  createDiscountCode,
  getDiscountCodes,
  updateDiscountCode,
  deleteDiscountCode,
  getDiscountAnalytics,
};