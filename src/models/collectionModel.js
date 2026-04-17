const pool = require("../config/db");

const findAll = async () => {
  const [rows] = await pool.execute(
    `SELECT id, slug, name, description, image, created_at, updated_at
     FROM collections
     ORDER BY created_at DESC`
  );

  return rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    image: row.image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

module.exports = {
  findAll,
};
