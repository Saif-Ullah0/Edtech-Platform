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
        where: { email }
    });
    if (!user) {
        throw new Error('User not found');
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
            role: user.role
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