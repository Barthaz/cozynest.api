const pool = require("../config/db");

const findByCode = async (code) => {
  const [rows] = await pool.execute(
    "SELECT id, code, email, type, value, is_used, created_at FROM promo_codes WHERE code = ? LIMIT 1",
    [code]
  );
  return rows[0] || null;
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
  findByCode,
  create,
  deleteById,
};
