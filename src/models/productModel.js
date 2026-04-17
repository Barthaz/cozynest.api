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

const effectiveUnitPriceFromRow = (row) => {
  const list = Number(row.price);
  const sale =
    row.sale_price !== null && row.sale_price !== undefined && row.sale_price !== ""
      ? Number(row.sale_price)
      : null;
  if (sale === null || Number.isNaN(sale)) {
    return Number.isFinite(list) ? list : 0;
  }
  return Math.min(list, sale);
};

const findByIdsAndSlugsForPricing = async (executor, normalizedItems) => {
  const ids = [
    ...new Set(
      normalizedItems
        .map((item) => item.productId)
        .filter((id) => id != null && id !== "")
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id))
    ),
  ];
  const slugs = [
    ...new Set(
      normalizedItems
        .map((item) => item.productSlug)
        .filter(Boolean)
        .map((s) => String(s).trim().toLowerCase())
    ),
  ];

  if (ids.length === 0 && slugs.length === 0) {
    return { byId: new Map(), bySlug: new Map() };
  }

  const parts = [];
  const params = [];
  if (ids.length) {
    parts.push(`id IN (${ids.map(() => "?").join(",")})`);
    params.push(...ids);
  }
  if (slugs.length) {
    parts.push(`LOWER(slug) IN (${slugs.map(() => "?").join(",")})`);
    params.push(...slugs);
  }

  const [rows] = await executor.execute(
    `SELECT id, slug, price, sale_price FROM products WHERE ${parts.join(" OR ")}`,
    params
  );

  const byId = new Map();
  const bySlug = new Map();
  for (const row of rows) {
    byId.set(Number(row.id), row);
    bySlug.set(String(row.slug).trim().toLowerCase(), row);
  }

  return { byId, bySlug };
};

const resolvePricingRow = (maps, item) => {
  if (item.productId != null && item.productId !== "") {
    const id = Number(item.productId);
    if (!Number.isNaN(id) && maps.byId.has(id)) {
      return maps.byId.get(id);
    }
  }
  if (item.productSlug) {
    const key = String(item.productSlug).trim().toLowerCase();
    if (maps.bySlug.has(key)) {
      return maps.bySlug.get(key);
    }
  }
  return null;
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
  findByIdsAndSlugsForPricing,
  resolvePricingRow,
  effectiveUnitPriceFromRow,
};
