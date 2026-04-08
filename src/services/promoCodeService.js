const promoCodeModel = require("../models/promoCodeModel");

const PROMO_CODE_LENGTH = 8;
const PROMO_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const getPromoType = () => {
  const rawType = String(process.env.PROMOCODE_TYPE || "single_use").toLowerCase();
  return rawType === "multi_use" ? "multi_use" : "single_use";
};

const getPromoValue = () => {
  const parsed = Number(process.env.PROMOCODE_VALUE || 10);
  if (Number.isNaN(parsed) || parsed <= 0) return 10;
  return parsed;
};

const generatePromoCodeCandidate = () => {
  let code = "";
  for (let i = 0; i < PROMO_CODE_LENGTH; i += 1) {
    const index = Math.floor(Math.random() * PROMO_CODE_ALPHABET.length);
    code += PROMO_CODE_ALPHABET[index];
  }
  return code;
};

const generateUniquePromoCode = async () => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const candidate = generatePromoCodeCandidate();
    const existing = await promoCodeModel.findByCode(candidate);
    if (!existing) return candidate;
  }

  throw new Error("Unable to generate unique promo code.");
};

const createPromoCodeForEmail = async (email) => {
  const code = await generateUniquePromoCode();
  const type = getPromoType();
  const value = getPromoValue();

  const id = await promoCodeModel.create({ code, email, type, value });

  return {
    id,
    code,
    email,
    type,
    value,
    isUsed: false,
  };
};

module.exports = {
  createPromoCodeForEmail,
};
