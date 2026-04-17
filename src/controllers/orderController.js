const pool = require("../config/db");
const orderModel = require("../models/orderModel");
const orderItemModel = require("../models/orderItemModel");
const orderStatusHistoryModel = require("../models/orderStatusHistoryModel");
const promoCodeModel = require("../models/promoCodeModel");
const productModel = require("../models/productModel");
const { createCheckoutSession } = require("../services/stripeService");

const toMoney = (value) => Number(Number(value || 0).toFixed(2));

const readNumericEnv = (key, fallback) => {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const getOrderPaymentStatus = async (req, res) => {
  const orderNumber = String(req.params.orderNumber || "").trim();

  if (!orderNumber) {
    return res.status(400).json({
      error: "Missing order number.",
    });
  }

  try {
    const order = await orderModel.findByOrderNumber(pool, orderNumber);

    if (!order) {
      return res.status(404).json({
        error: "Order not found.",
      });
    }

    const paymentStatus = order.status === "paid" ? "paid" : "unpaid";

    return res.status(200).json({
      data: {
        id: Number(order.id),
        orderNumber: order.order_number,
        status: order.status,
        paymentStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch order status.",
      details: error?.message || "Unknown order status error.",
    });
  }
};

const createOrder = async (req, res) => {
  const {
    customerFullName,
    customerEmail,
    customerPhone,
    shippingStreet,
    shippingHouseNumber,
    shippingApartmentNumber = null,
    shippingPostalCode,
    shippingCity,
    shippingRegion,
    shippingCountry = "Polska",
    paymentMethod = "przelew",
    deliveryMethod = "kurier",
    currency = "PLN",
    discountCode = null,
    discountPercent = 0,
    promoCode = null,
    shippingAmount = 0,
    notesCustomer = null,
    items,
  } = req.body || {};

  if (
    !customerFullName ||
    !customerEmail ||
    !customerPhone ||
    !shippingStreet ||
    !shippingHouseNumber ||
    !shippingPostalCode ||
    !shippingCity ||
    !shippingRegion
  ) {
    return res.status(400).json({
      error: "Missing required customer or shipping fields.",
    });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      error: "Order must contain at least one item.",
    });
  }

  const normalizedItems = items.map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = toMoney(item.unitPrice);
    const lineTotal = toMoney(quantity * unitPrice);

    return {
      productId: item.productId || null,
      productSlug: item.productSlug || null,
      productName: item.productName,
      variantColor: item.variantColor,
      variantSize: item.variantSize,
      quantity,
      unitPrice,
      lineTotal,
      imageUrl: item.imageUrl || null,
      collectionSlug: item.collectionSlug || null,
    };
  });

  const invalidItem = normalizedItems.find(
    (item) =>
      !item.productName ||
      !item.variantColor ||
      !item.variantSize ||
      item.quantity <= 0 ||
      item.unitPrice < 0
  );

  if (invalidItem) {
    return res.status(400).json({
      error: "Invalid order item payload.",
    });
  }

  const subtotalAmount = toMoney(
    normalizedItems.reduce((sum, item) => sum + item.lineTotal, 0)
  );

  let pricingMaps;
  try {
    pricingMaps = await productModel.findByIdsAndSlugsForPricing(pool, normalizedItems);
  } catch (error) {
    return res.status(500).json({
      error: "Failed to load product prices for validation.",
      details: error?.message || "Unknown pricing error.",
    });
  }

  for (const item of normalizedItems) {
    const row = productModel.resolvePricingRow(pricingMaps, item);
    if (!row) {
      return res.status(400).json({
        error: "Unknown product in order line.",
        details: `Brak produktu w katalogu dla id=${item.productId ?? "—"}, slug=${item.productSlug ?? "—"}.`,
      });
    }
  }

  const connection = await pool.getConnection();

  let orderId = null;
  let orderNumber = null;
  let normalizedDiscountPercent = toMoney(discountPercent);
  let discountAmount = toMoney(
    subtotalAmount * (normalizedDiscountPercent / 100)
  );
  let normalizedShippingAmount = toMoney(shippingAmount);
  let finalAmount = toMoney(
    subtotalAmount - discountAmount + normalizedShippingAmount
  );
  let appliedDiscountCode = discountCode;
  let initialOrderStatus = "new";
  let postCommitPriceSuspicious = false;

  try {
    await connection.beginTransaction();

    let promoRowId = null;

    if (promoCode) {
      const normalizedPromoCode = promoCodeModel.normalizeCode(promoCode);

      if (!/^[A-Z0-9]{8}$/.test(normalizedPromoCode)) {
        await connection.rollback();
        return res.status(400).json({
          error: "Invalid promo code format.",
        });
      }

      const promo = await promoCodeModel.findByCodeForUpdate(
        connection,
        normalizedPromoCode
      );

      if (!promo) {
        await connection.rollback();
        return res.status(404).json({
          error: "Promo code not found.",
        });
      }

      if (promo.email !== String(customerEmail).trim().toLowerCase()) {
        await connection.rollback();
        return res.status(403).json({
          error: "Promo code is not valid for this email address.",
        });
      }

      if (promo.type === "single_use" && promo.is_used) {
        await connection.rollback();
        return res.status(409).json({
          error: "Promo code has already been used.",
        });
      }

      normalizedDiscountPercent = toMoney(promo.value);
      discountAmount = toMoney(subtotalAmount * (normalizedDiscountPercent / 100));
      normalizedShippingAmount = toMoney(shippingAmount);
      finalAmount = toMoney(
        Math.max(0, subtotalAmount - discountAmount + normalizedShippingAmount)
      );
      appliedDiscountCode = promo.code;
      promoRowId = promo.id;
    }

    let expectedSubtotal = 0;
    for (const item of normalizedItems) {
      const row = productModel.resolvePricingRow(pricingMaps, item);
      const unit = toMoney(productModel.effectiveUnitPriceFromRow(row));
      expectedSubtotal = toMoney(expectedSubtotal + unit * item.quantity);
    }

    const expectedDiscountAmount = toMoney(
      expectedSubtotal * (normalizedDiscountPercent / 100)
    );
    const expectedFinal = toMoney(
      Math.max(0, expectedSubtotal - expectedDiscountAmount) + normalizedShippingAmount
    );

    const tolerancePercent = readNumericEnv("ORDER_PRICE_TOLERANCE_PERCENT", 3);
    const toleranceFixed = toMoney(readNumericEnv("ORDER_PRICE_TOLERANCE_FIXED", 0.02));
    const minAllowedFinal = toMoney(
      Math.max(0, expectedFinal * (1 - tolerancePercent / 100) - toleranceFixed)
    );
    const priceOk = toMoney(finalAmount - minAllowedFinal) >= 0;

    initialOrderStatus = priceOk ? "new" : "podejrzane";
    const notesInternal = priceOk
      ? null
      : `Walidacja kwoty: wg katalogu ref. ${expectedFinal} (min. dozwolone ~${minAllowedFinal} przy tolerancji ${tolerancePercent}% + ${toleranceFixed}), przesłano ${finalAmount}.`;

    orderNumber = await orderModel.generateUniqueOrderNumber(connection);
    orderId = await orderModel.createOrder(connection, {
      orderNumber,
      customerFullName,
      customerEmail,
      customerPhone,
      shippingStreet,
      shippingHouseNumber,
      shippingApartmentNumber,
      shippingPostalCode,
      shippingCity,
      shippingRegion,
      shippingCountry,
      paymentMethod,
      deliveryMethod,
      currency,
      subtotalAmount,
      discountCode: appliedDiscountCode,
      discountPercent: normalizedDiscountPercent,
      discountAmount,
      shippingAmount: normalizedShippingAmount,
      finalAmount,
      status: initialOrderStatus,
      notesCustomer,
      notesInternal,
      ipAddress: req.ip || null,
      userAgent: req.get("user-agent") || null,
    });

    await orderItemModel.createOrderItems(connection, orderId, normalizedItems);
    await orderStatusHistoryModel.addStatusHistoryEntry(connection, {
      orderId,
      oldStatus: null,
      newStatus: initialOrderStatus,
      comment: priceOk
        ? "Order created"
        : "Utworzono jako podejrzane — przesłana kwota niższa niż wynika z cen w katalogu (bez płatności).",
      changedBy: "system",
    });

    if (promoCode && priceOk) {
      await promoCodeModel.markUsedIfSingleUse(connection, promoRowId);
    }

    await connection.commit();
    postCommitPriceSuspicious = initialOrderStatus === "podejrzane";
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({
      error: "Failed to create order.",
      details: error?.message || "Unknown order error.",
    });
  } finally {
    connection.release();
  }

  if (postCommitPriceSuspicious) {
    return res.status(422).json({
      error:
        "Nie udało się przejść do płatności — kwoty zamówienia nie pokrywają się z aktualnymi cenami w sklepie (możliwa manipulacja ceną po stronie klienta).",
      code: "price_mismatch",
      data: {
        id: orderId,
        orderNumber,
        status: "podejrzane",
        currency,
        subtotalAmount,
        discountCode: appliedDiscountCode,
        discountPercent: normalizedDiscountPercent,
        discountAmount,
        shippingAmount: normalizedShippingAmount,
        finalAmount,
      },
    });
  }

  try {
    const checkoutSession = await createCheckoutSession({
      orderNumber,
      customerEmail,
      finalAmount,
    });

    await orderModel.updateStatusByOrderNumber(pool, orderNumber, "pending_payment");
    await orderStatusHistoryModel.addStatusHistoryEntry(pool, {
      orderId,
      oldStatus: "new",
      newStatus: "pending_payment",
      comment: "Stripe checkout session created",
      changedBy: "system",
    });

    return res.status(201).json({
      message: "Order created successfully.",
      data: {
        id: orderId,
        orderNumber,
        status: "pending_payment",
        currency,
        subtotalAmount,
        discountCode: appliedDiscountCode,
        discountPercent: normalizedDiscountPercent,
        discountAmount,
        shippingAmount: normalizedShippingAmount,
        finalAmount,
        stripe: {
          publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
          sessionId: checkoutSession.id,
          checkoutUrl: checkoutSession.url,
        },
      },
    });
  } catch (error) {
    return res.status(502).json({
      error: "Order created, but failed to initialize Stripe checkout.",
      details: error?.message || "Unknown Stripe error.",
      data: {
        id: orderId,
        orderNumber,
        status: "new",
      },
    });
  }
};

module.exports = {
  createOrder,
  getOrderPaymentStatus,
};
