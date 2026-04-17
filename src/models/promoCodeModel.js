const pool = require("../config/db");

const normalizeCode = (code) => String(code || "").trim().toUpperCase();

const findByCode = async (code) => {
  const [rows] = await pool.execute(
    "SELECT id, code, email, type, value, is_used, created_at FROM promo_codes WHERE code = ? LIMIT 1",
    [normalizeCode(code)]
  );
  return rows[0] || null;
};

const findByCodeForUpdate = async (connection, code) => {
  const [rows] = await connection.execute(
    "SELECT id, code, email, type, value, is_used, created_at FROM promo_codes WHERE code = ? LIMIT 1 FOR UPDATE",
    [normalizeCode(code)]
  );
  return rows[0] || null;
};

const markUsedIfSingleUse = async (connection, promoId) => {
  await connection.execute(
    "UPDATE promo_codes SET is_used = 1 WHERE id = ? AND type = 'single_use' AND is_used = 0",
    [promoId]
  );
};

const create = async ({ code, email, type, value }) => {
  const [result] = await pool.execute(
    "INSERT INTO promo_codes (code, email, type, value, is_used) VALUES (?, ?, ?, ?, ?)",
    [code, email, type, value, false]
  );
  return result.insertId;
};

const deleteById = async (id) => {
  await pool.execute("DELETE FROM promo_codes WHERE id = ?", [id]);
};

module.exports = {
  normalizeCode,
  findByCode,
  findByCodeForUpdate,
  markUsedIfSingleUse,
  create,
  deleteById,
};
