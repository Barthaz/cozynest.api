const express = require("express");
const { createOrder, getOrderPaymentStatus } = require("../controllers/orderController");

const router = express.Router();

router.post("/orders", createOrder);
router.get("/orders/:orderNumber/status", getOrderPaymentStatus);

module.exports = router;
