const pool = require("../config/db");
const orderModel = require("../models/orderModel");
const orderItemModel = require("../models/orderItemModel");
const orderStatusHistoryModel = require("../models/orderStatusHistoryModel");
const { constructWebhookEvent } = require("../services/stripeService");
const { sendOrderPaidEmail } = require("../services/mailService");

const isCheckoutSessionPaid = (session) => {
  const status = session?.payment_status;
  return status === "paid" || status === "no_payment_required";
};

const finalizeOrderFromCheckoutSession = async (session, logContext) => {
  const orderNumber = session?.metadata?.orderNumber;

  if (!orderNumber) {
    console.warn("[stripe_webhook] Brak metadata.orderNumber na sesji Checkout.", {
      ...logContext,
      sessionId: session?.id || null,
    });
    return { ok: false, reason: "missing_order_number" };
  }

  const existingOrder = await orderModel.findByOrderNumber(pool, orderNumber);

  if (!existingOrder) {
    console.warn("[stripe_webhook] Nie znaleziono zamówienia w bazie.", {
      ...logContext,
      orderNumber,
    });
    return { ok: false, reason: "order_not_found" };
  }

  if (existingOrder.status === "paid") {
    console.info("[stripe_webhook] Zamówienie już ma status paid — pomijam.", {
      ...logContext,
      orderNumber,
    });
    return { ok: true, reason: "already_paid" };
  }

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
    const emailResult = await sendOrderPaidEmail({
      order: existingOrder,
      items,
      checkoutSession: session,
    });
    if (!emailResult.sent && emailResult.reason === "mail_disabled") {
      console.warn("[stripe_webhook] Mail po płatności pominięty (MAIL_ENABLED !== true).", {
        orderNumber,
      });
    }
  } catch (emailError) {
    console.error("[stripe_webhook] Nie udało się wysłać maila po płatności:", {
      orderNumber,
      message: emailError?.message,
    });
  }

  console.info("[stripe_webhook] Zamówienie oznaczone jako paid.", {
    ...logContext,
    orderNumber,
  });

  return { ok: true, reason: "updated" };
};

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

  console.info("[stripe_webhook] Odebrano event.", {
    id: event.id,
    type: event.type,
  });

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;

      if (!isCheckoutSessionPaid(session)) {
        console.info(
          "[stripe_webhook] checkout.session.completed — płatność jeszcze nie potwierdzona (payment_status). Czekamy na async lub kolejny event.",
          {
            sessionId: session.id,
            payment_status: session.payment_status,
            orderNumber: session?.metadata?.orderNumber || null,
          }
        );
      } else {
        await finalizeOrderFromCheckoutSession(session, {
          eventType: event.type,
          eventId: event.id,
        });
      }
    } else if (event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data.object;
      await finalizeOrderFromCheckoutSession(session, {
        eventType: event.type,
        eventId: event.id,
      });
    }
  } catch (error) {
    return res.status(500).json({
      error: "Failed to update order status from Stripe webhook.",
      details: error?.message || "Unknown webhook update error.",
    });
  }

  return res.status(200).json({ received: true });
};

module.exports = {
  handleStripeWebhook,
};
