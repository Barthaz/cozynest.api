const express = require("express");
const { verifyPromoCode } = require("../controllers/promoCodeController");

const router = express.Router();

router.get("/promocodes/:code", verifyPromoCode);

module.exports = router;
