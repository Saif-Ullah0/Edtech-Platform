require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Route imports
const authRoutes = require('./routes/authRoutes');
const protectedRoutes = require('./routes/protectedRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const courseRoutes = require('./routes/courseRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
//const moduleRoutes = require('./routes/moduleRoutes');

// Middleware
const requireAuth = require('./middlewares/requireAuth');

const app = express();

// ✅ Enable CORS for frontend & cookies
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true, // ✅ allow cookies
}));

// ✅ Middleware to parse incoming JSON and cookies
app.use(express.json());
app.use(cookieParser());

// ✅ Route usage
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enroll', requireAuth, enrollmentRoutes); // ✅ Protect this route
//app.use('/api/modules', requireAuth, moduleRoutes);    // ✅ Protect this too

// ✅ Simple health check route
app.get('/', (req, res) => {
  res.send('✅ Backend is running');
});

// ✅ Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
