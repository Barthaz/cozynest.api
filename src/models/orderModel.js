const generateOrderNumber = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const randomPart = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, "0");

  return `CN-${yyyy}${mm}${dd}-${randomPart}`;
};

const generateUniqueOrderNumber = async (connection) => {
  for (let i = 0; i < 10; i += 1) {
    const candidate = generateOrderNumber();
    const [rows] = await connection.execute(
      "SELECT id FROM orders WHERE order_number = ? LIMIT 1",
      [candidate]
    );
    if (rows.length === 0) return candidate;
  }

  throw new Error("Unable to generate unique order number.");
};

const createOrder = async (connection, payload) => {
  const [result] = await connection.execute(
    `INSERT INTO orders (
      order_number,
      customer_full_name,
      customer_email,
      customer_phone,
      shipping_street,
      shipping_house_number,
      shipping_apartment_number,
      shipping_postal_code,
      shipping_city,
      shipping_region,
      shipping_country,
      payment_method,
      delivery_method,
      currency,
      subtotal_amount,
      discount_code,
      discount_percent,
      discount_amount,
      shipping_amount,
      final_amount,
      status,
      notes_customer,
      notes_internal,
      ip_address,
      user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payload.orderNumber,
      payload.customerFullName,
      payload.customerEmail,
      payload.customerPhone,
      payload.shippingStreet,
      payload.shippingHouseNumber,
      payload.shippingApartmentNumber,
      payload.shippingPostalCode,
      payload.shippingCity,
      payload.shippingRegion,
      payload.shippingCountry,
      payload.paymentMethod,
      payload.deliveryMethod,
      payload.currency,
      payload.subtotalAmount,
      payload.discountCode,
      payload.discountPercent,
      payload.discountAmount,
      payload.shippingAmount,
      payload.finalAmount,
      payload.status,
      payload.notesCustomer,
      payload.notesInternal,
      payload.ipAddress,
      payload.userAgent,
    ]
  );

  return result.insertId;
};

const findByOrderNumber = async (executor, orderNumber) => {
  const [rows] = await executor.execute(
    `SELECT
      id,
      order_number,
      status,
      customer_full_name,
      customer_email,
      customer_phone,
      shipping_street,
      shipping_house_number,
      shipping_apartment_number,
      shipping_postal_code,
      shipping_city,
      shipping_region,
      shipping_country,
      payment_method,
      delivery_method,
      currency,
      subtotal_amount,
      discount_code,
      discount_percent,
      discount_amount,
      shipping_amount,
      final_amount,
      created_at
     FROM orders
     WHERE order_number = ?
     LIMIT 1`,
    [orderNumber]
  );

  return rows[0] || null;
};

const updateStatusByOrderNumber = async (executor, orderNumber, status) => {
  await executor.execute("UPDATE orders SET status = ? WHERE order_number = ?", [
    status,
    orderNumber,
  ]);
};

module.exports = {
  generateUniqueOrderNumber,
  createOrder,
  findByOrderNumber,
  updateStatusByOrderNumber,
};
