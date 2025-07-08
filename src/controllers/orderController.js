// src/controllers/orderController.js
const orderService = require("../services/orderService");

exports.createOrder = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user?.userId; // ✅ safer access to JWT payload

    const order = await orderService.createOrder(userId, courseId);

    res.status(201).json(order);
  } catch (err) {
    console.error("Create Order Error:", err);
    res.status(500).json({ error: err.message || "Failed to create order" });
  }
};
