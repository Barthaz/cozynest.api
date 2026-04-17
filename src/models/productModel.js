const pool = require("../config/db");

const parseJsonField = (value, fallback) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const findAll = async () => {
  const [rows] = await pool.execute(
    `SELECT
      id,
      slug,
      name,
      description,
      short_description,
      detailed_description,
      specifications,
      price,
      sale_price,
      featured,
      stock,
      images,
      category,
      colors,
      sizes,
      collection_slug,
      created_at,
      updated_at
     FROM products
     ORDER BY created_at DESC`
  );

  return rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    description: row.description,
    shortDescription: row.short_description,
    detailedDescription: parseJsonField(row.detailed_description, []),
    specifications: parseJsonField(row.specifications, []),
    price: Number(row.price),
    salePrice: row.sale_price !== null ? Number(row.sale_price) : null,
    featured: Boolean(row.featured),
    stock: Number(row.stock),
    images: parseJsonField(row.images, []),
    category: row.category,
    colors: parseJsonField(row.colors, []),
    sizes: parseJsonField(row.sizes, []),
    collectionSlug: row.collection_slug,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

module.exports = {
  findAll,
};
