const prisma = require('../../prisma/client');

const getAllEnrollments = async (req, res) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        course: {
          select: {
            id: true,
            title: true,
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json(enrollments);
  } catch (error) {
    console.error('Error fetching enrollments:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
};

module.exports = {
  getAllEnrollments,
};
