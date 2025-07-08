// routes/orderRoutes.js
const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const requireAuth = require("../middlewares/requireAuth");

router.post("/create", requireAuth, orderController.createOrder);

module.exports = router;
