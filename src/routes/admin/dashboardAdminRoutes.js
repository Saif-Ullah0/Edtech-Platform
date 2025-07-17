// backend/routes/admin/dashboardAdminRoutes.js
const express = require('express');
const router = express.Router();

// Simple test endpoint first
router.get('/', (req, res) => {
  console.log('🎉 BACKEND Dashboard: Route hit successfully!');
  console.log('🔍 BACKEND Dashboard: User from request:', req.user);
  
  try {
    // Return simple test data for now
    const testData = {
      totalUsers: 10,
      totalCourses: 5,
      totalEnrollments: 25,
      totalRevenue: 50000,
      recentEnrollments: [
        {
          id: 1,
          user: { id: 1, name: 'Test User', email: 'test@example.com' },
          course: { id: 1, title: 'Test Course' },
          createdAt: new Date().toISOString()
        }
      ]
    };
    
    console.log('✅ BACKEND Dashboard: Sending test data:', testData);
    res.json(testData);
  } catch (error) {
    console.error('❌ BACKEND Dashboard: Error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;