// backend/src/controllers/discountController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Validate discount code
const validateDiscountCode = async (req, res) => {
  try {
    const { code, purchaseAmount } = req.body;
    const userId = req.user.id;
    
    if (!code || !purchaseAmount) {
      return res.status(400).json({
        success: false,
        message: 'Discount code and purchase amount are required'
      });
    }
    
    const discountCode = await prisma.discountCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        usages: {
          where: { userId }
        }
      }
    });
    
    if (!discountCode) {
      return res.status(404).json({
        success: false,
        message: 'Invalid discount code'
      });
    }
    
    if (!discountCode.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This discount code is no longer active'
      });
    }
    
    // Check expiry
    if (discountCode.expiresAt && new Date() > discountCode.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This discount code has expired'
      });
    }
    
    // Check usage limits
    if (discountCode.maxUses && discountCode.usedCount >= discountCode.maxUses) {
      return res.status(400).json({
        success: false,
        message: 'This discount code has reached its usage limit'
      });
    }
    
    // Check per-user usage
    if (discountCode.maxUsesPerUser && discountCode.usages.length >= discountCode.maxUsesPerUser) {
      return res.status(400).json({
        success: false,
        message: 'You have already used this discount code'
      });
    }
    
    // Check minimum purchase
    if (discountCode.minPurchaseAmount && purchaseAmount < discountCode.minPurchaseAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase amount of $${discountCode.minPurchaseAmount} required`
      });
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
          value: discountCode.value
        },
        calculation: {
          originalAmount: purchaseAmount,
          discountAmount: Number(discountAmount.toFixed(2)),
          finalAmount: Number(finalAmount.toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error('Error validating discount:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate discount code'
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

module.exports = {
  validateDiscountCode,
  applyDiscountCode,
  createDiscountCode,
  getDiscountCodes
};