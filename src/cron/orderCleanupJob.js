const cron = require('node-cron');
const prisma = require('../../prisma/client');

const cancelStaleOrders = async () => {
  const threshold = new Date(Date.now() - 25 * 60 * 1000); // 25 minutes ago

  try {
    const staleOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lt: threshold },
      },
    });

    for (const order of staleOrders) {
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'CANCELED' },
      });

      console.log(` Canceled stale order ID ${order.id}`);
    }
  } catch (error) {
    console.error('Error cancelling stale orders:', error.message);
  }
};

const startOrderCleanupJob = () => {
  cron.schedule('*/10 * * * *', () => {
    console.log(' Running stale order cleanup job...');
    cancelStaleOrders();
  });
};

module.exports = startOrderCleanupJob;
