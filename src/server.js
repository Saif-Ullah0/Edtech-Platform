require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/authRoutes');
const protectedRoutes = require('./routes/protectedRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const courseRoutes = require('./routes/courseRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminCategoryRoutes = require('./routes/admin/categoryAdminRoutes');
const adminCourseRoutes = require('./routes/admin/courseAdminRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const adminModuleRoutes = require('./routes/admin/moduleAdminRoutes');
const adminDashboardRoutes = require('./routes/admin/dashboardAdminRoutes');
const adminEnrollmentRoutes = require('./routes/admin/enrollmentAdminRoutes');
const adminUserRoutes = require('./routes/admin/userAdminRoutes');
const orderRoutes = require("./routes/orderRoutes");

const videoRoutes = require('./routes/videoRoutes');
const progressRoutes = require('./routes/progressRoutes');

const requireAuth = require('./middlewares/requireAuth');
const requireAdmin = require('./middlewares/requireAdmin');
const notesRoutes = require('./routes/notesRoutes');

const startOrderCleanupJob = require('./cron/orderCleanupJob');
startOrderCleanupJob();

const app = express();

const uploadDirs = [
  '../uploads',                   
  '../uploads/videos',             
  '../uploads/videos/thumbnails'
];

uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/webhook', webhookRoutes); 

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/payment', paymentRoutes);
app.use("/api/order", orderRoutes);

app.use('/api/enroll', requireAuth, enrollmentRoutes);

app.use('/api/videos', videoRoutes);

app.use('/api/progress', progressRoutes);


app.use('/api/notes', notesRoutes);

// Admin routes (require authentication + admin role)
app.use('/api/admin/categories', requireAuth, requireAdmin, adminCategoryRoutes);
app.use('/api/admin/courses', requireAuth, requireAdmin, adminCourseRoutes);
app.use('/api/admin/modules', requireAuth, requireAdmin, adminModuleRoutes);
app.use('/api/admin/dashboard', requireAuth, requireAdmin, adminDashboardRoutes);
app.use('/api/admin/enrollments', requireAuth, requireAdmin, adminEnrollmentRoutes);
app.use('/api/admin/users', requireAuth, requireAdmin, adminUserRoutes);

app.get('/api/me', requireAuth, (req, res) => {
  try {
    console.log('GET /api/me - User from token:', req.user);
    
    res.status(200).json({
      id: req.user.userId,
      role: req.user.role,
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

app.use('/api/debug', require('./routes/debugRoutes'));

app.get('/', (req, res) => {
  res.send('Backend is running');
});

app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message 
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`Video uploads available at: http://localhost:${PORT}/uploads/videos/`);
});