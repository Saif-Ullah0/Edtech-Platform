const jwt = require("../utils/jwt");
const bcrypt = require("bcrypt");
const prisma = require("../../prisma/client");

const registerUser = async ({name, email, password}) => {
    const existingUser = await prisma.user.findUnique({
        where: { email }
    });
    if (existingUser) {
        throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            role: 'USER' 
        }
    });
    const token = jwt.generateToken(newUser.id, newUser.role);
    return{
        user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        },
        token
    };
};

const loginUser = async ({email, password}) => {
    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            id: true,
            name: true,
            email: true,
            password: true,
            role: true,
            status: true    // 🆕 ADD THIS LINE
        }
    });
    
    if (!user) {
        throw new Error('User not found');
    }

    // 🆕 ADD THESE STATUS CHECKS
    if (user.status === 'BANNED') {
        throw new Error('Account has been banned. Please contact support.');
    }

    if (user.status === 'DELETED') {
        throw new Error('Account has been deactivated.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        throw new Error('Invalid password');
    }

    const token = jwt.generateToken(user.id, user.role);
    return {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status  // 🆕 ADD THIS LINE
        },
        token
    };
}

const getUserById = async (userId) => {
  try {
    const user = await prisma.user.findUnique({
      where: {
        id: userId
      }
    });
    
    return user;
  } catch (error) {
    console.error('Get user by ID error:', error);
    throw new Error('Failed to get user');
  }
};



module.exports = {
    registerUser,
    loginUser,
    getUserById
};