const pool = require("../config/db");
const orderModel = require("../models/orderModel");
const orderItemModel = require("../models/orderItemModel");
const orderStatusHistoryModel = require("../models/orderStatusHistoryModel");
const { constructWebhookEvent } = require("../services/stripeService");
const { sendOrderPaidEmail } = require("../services/mailService");

const handleStripeWebhook = async (req, res) => {
  const signature = req.headers["stripe-signature"];

  if (!signature) {
    return res.status(400).json({ error: "Missing stripe-signature header." });
  }

  let event;

  try {
    event = constructWebhookEvent(req.body, signature);
  } catch (error) {
    return res.status(400).json({
      error: "Invalid Stripe webhook signature.",
      details: error?.message || "Unknown webhook verification error.",
    });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const orderNumber = session?.metadata?.orderNumber;

    if (orderNumber) {
      try {
        const existingOrder = await orderModel.findByOrderNumber(pool, orderNumber);

        if (existingOrder && existingOrder.status !== "paid") {
          await orderModel.updateStatusByOrderNumber(pool, orderNumber, "paid");
          await orderStatusHistoryModel.addStatusHistoryEntry(pool, {
            orderId: existingOrder.id,
            oldStatus: existingOrder.status,
            newStatus: "paid",
            comment: "Stripe checkout session completed",
            changedBy: "stripe_webhook",
          });

          const items = await orderItemModel.findByOrderId(pool, existingOrder.id);
          try {
            await sendOrderPaidEmail({
              order: existingOrder,
              items,
            });
          } catch (emailError) {
            console.error("Failed to send order paid email:", {
              orderNumber,
              message: emailError?.message,
            });
          }
        }
      } catch (error) {
        return res.status(500).json({
          error: "Failed to update order status from Stripe webhook.",
          details: error?.message || "Unknown webhook update error.",
        });
      }
    }
  }

  return res.status(200).json({ received: true });
};

module.exports = {
  handleStripeWebhook,
};
