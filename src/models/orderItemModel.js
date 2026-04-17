const createOrderItems = async (connection, orderId, items) => {
  for (const item of items) {
    await connection.execute(
      `INSERT INTO order_items (
        order_id,
        product_id,
        product_slug,
        product_name,
        variant_color,
        variant_size,
        quantity,
        unit_price,
        line_total,
        image_url,
        collection_slug
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId,
        item.productId,
        item.productSlug,
        item.productName,
        item.variantColor,
        item.variantSize,
        item.quantity,
        item.unitPrice,
        item.lineTotal,
        item.imageUrl,
        item.collectionSlug,
      ]
    );
  }
};

const findByOrderId = async (executor, orderId) => {
  const [rows] = await executor.execute(
    `SELECT
      id,
      product_id,
      product_slug,
      product_name,
      variant_color,
      variant_size,
      quantity,
      unit_price,
      line_total,
      image_url,
      collection_slug
     FROM order_items
     WHERE order_id = ?
     ORDER BY id ASC`,
    [orderId]
  );

  return rows;
};

module.exports = {
  createOrderItems,
  findByOrderId,
};
