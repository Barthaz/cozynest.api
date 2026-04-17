const express = require("express");
const { verifyPromoCode, getPromoDiscount } = require("../controllers/promoCodeController");

const router = express.Router();

router.get("/promocodes/:code", verifyPromoCode);
router.get("/promocodes/:code/discount", getPromoDiscount);

module.exports = router;
