const Stripe = require("stripe");

let stripeClient = null;

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Missing STRIPE_SECRET_KEY");
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  return stripeClient;
};

const getStripePaymentMethods = () => {
  const raw = process.env.STRIPE_PAYMENT_METHOD_TYPES || "card";
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const createCheckoutSession = async ({ orderNumber, customerEmail, finalAmount }) => {
  const stripe = getStripeClient();
  const amount = Math.round(Number(finalAmount) * 100);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid final amount for Stripe session.");
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: getStripePaymentMethods(),
    customer_email: customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: (process.env.STRIPE_CURRENCY || "pln").toLowerCase(),
          product_data: {
            name: `Zamowienie ${orderNumber}`,
            description: "Platnosc za zamowienie w Cozy Nest",
          },
          unit_amount: amount,
        },
      },
    ],
    metadata: {
      orderNumber,
    },
    success_url:
      process.env.STRIPE_SUCCESS_URL ||
      "http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}",
    cancel_url:
      process.env.STRIPE_CANCEL_URL || "http://localhost:5173/checkout/cancel",
  });

  return session;
};

const constructWebhookEvent = (rawBody, signature) => {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("Missing STRIPE_WEBHOOK_SECRET");
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
};

const checkStripeHealth = async () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      status: "not_configured",
      message: "Missing STRIPE_SECRET_KEY.",
      mode: null,
    };
  }

  try {
    const stripe = getStripeClient();
    await stripe.balance.retrieve();

    const secretKey = process.env.STRIPE_SECRET_KEY;
    const mode = secretKey.startsWith("sk_live")
      ? "live"
      : secretKey.startsWith("sk_test")
        ? "test"
        : "unknown";

    return {
      status: "connected",
      message: "Stripe API connection is working.",
      mode,
    };
  } catch (error) {
    return {
      status: "disconnected",
      message: error?.message || "Stripe API connection failed.",
      mode: null,
    };
  }
};

const getCheckoutPaidPaymentMethodLabel = async (session) => {
  if (!session) return null;

  const piRef = session.payment_intent;
  if (!piRef) return null;

  try {
    const stripe = getStripeClient();
    const piId = typeof piRef === "string" ? piRef : piRef.id;
    const pi = await stripe.paymentIntents.retrieve(piId, {
      expand: ["payment_method"],
    });

    let pm = pi.payment_method;
    if (!pm) return null;
    if (typeof pm === "string") {
      pm = await stripe.paymentMethods.retrieve(pm);
    }

    const type = pm.type;
    if (type === "card" && pm.card) {
      const brand = pm.card.brand ? String(pm.card.brand).toUpperCase() : "";
      const last4 = pm.card.last4 ? ` •••• ${pm.card.last4}` : "";
      return brand ? `Karta płatnicza (${brand})${last4}` : `Karta płatnicza${last4}`;
    }
    if (type === "blik") return "BLIK";
    if (type === "p24") return "Przelewy24";
    if (type === "paypal") return "PayPal";
    if (type === "ideal") return "iDEAL";
    if (type === "klarna") return "Klarna";
    if (type === "link") return "Link";
    if (type === "eps") return "EPS";
    if (type === "sepa_debit") return "SEPA Direct Debit";
    if (type === "customer_balance") return "Saldo klienta";
    if (type === "affirm") return "Affirm";
    if (type === "afterpay_clearpay") return "Clearpay";

    return `Płatność online (${type})`;
  } catch (error) {
    console.error("[stripe] getCheckoutPaidPaymentMethodLabel:", error?.message || error);
    return null;
  }
};

module.exports = {
  createCheckoutSession,
  constructWebhookEvent,
  checkStripeHealth,
  getCheckoutPaidPaymentMethodLabel,
};
