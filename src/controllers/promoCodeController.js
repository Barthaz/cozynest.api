const promoCodeModel = require("../models/promoCodeModel");

const verifyPromoCode = async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();

  if (!/^[A-Z0-9]{8}$/.test(code)) {
    return res.status(400).json({
      error: "Invalid promo code format.",
    });
  }

  try {
    const promo = await promoCodeModel.findByCode(code);
    if (!promo) {
      return res.status(404).json({
        error: "Promo code not found.",
      });
    }

    return res.status(200).json({
      data: {
        code: promo.code,
        value: Number(promo.value),
        type: promo.type,
        isUsed: Boolean(promo.is_used),
        email: promo.email,
        createdAt: promo.created_at,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to verify promo code.",
      details: error?.message || "Unknown promo code error.",
    });
  }
};

module.exports = {
  verifyPromoCode,
};
