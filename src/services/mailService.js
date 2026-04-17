const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const isMailEnabled = () => process.env.MAIL_ENABLED === "true";
const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
};

const createTransporter = () => {
  const allowSelfSigned = toBool(process.env.SMTP_ALLOW_SELF_SIGNED, false);
  const verifyPeer = toBool(process.env.SMTP_VERIFY_PEER, true);

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: toBool(process.env.SMTP_SECURE, false),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: allowSelfSigned ? false : verifyPeer,
      checkServerIdentity: toBool(process.env.SMTP_VERIFY_PEER_NAME, true)
        ? undefined
        : () => undefined,
    },
  });
};

const renderTemplate = (templateName, variables) => {
  const templatePath = path.join(__dirname, "..", "templates", templateName);
  let html = fs.readFileSync(templatePath, "utf8");

  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    html = html.replace(placeholder, String(value));
  });

  return html;
};

const formatMoney = (value) => Number(value || 0).toFixed(2);

const buildOrderItemsRowsHtml = (items, currency) => {
  return items
    .map(
      (item) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #eee7d9;color:#111111;">
          <div style="font-weight:700;">${item.product_name}</div>
          <div style="font-size:12px;color:#6b7280;">${item.variant_color} / ${item.variant_size}</div>
        </td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #eee7d9;color:#111111;">${item.quantity}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #eee7d9;color:#111111;">${formatMoney(item.line_total)} ${currency}</td>
      </tr>`
    )
    .join("");
};

const sendNewsletterWelcomeEmail = async (toEmail, promoCodeData = null) => {
  if (!isMailEnabled()) {
    return { sent: false, reason: "mail_disabled" };
  }

  const transporter = createTransporter();
  const from = process.env.MAIL_FROM;
  const subject =
    process.env.MAIL_NEWSLETTER_SUBJECT || "Witaj w newsletterze Cozy Nest";
  const html = renderTemplate("newsletter-welcome.html", {
    email: toEmail,
    promoCode: promoCodeData?.code || "",
    promoValue: promoCodeData?.value || "",
  });
  const text = [
    "Witaj w Cozy Nest!",
    "",
    "Dziekujemy za zapis do newslettera.",
    `Adres zapisu: ${toEmail}`,
    promoCodeData?.code ? `Kod promocyjny: ${promoCodeData.code}` : "",
    promoCodeData?.value ? `Wartosc rabatu: ${promoCodeData.value}%` : "",
    "",
    "Nowosci i inspiracje: https://cozy-nest.pl/",
  ]
    .filter(Boolean)
    .join("\n");

  const info = await transporter.sendMail({
    from,
    to: toEmail,
    subject,
    html,
    text,
  });

  return {
    sent: true,
    messageId: info?.messageId || null,
    accepted: info?.accepted || [],
    rejected: info?.rejected || [],
    response: info?.response || null,
  };
};

const sendOrderPaidEmail = async ({ order, items }) => {
  if (!isMailEnabled()) {
    return { sent: false, reason: "mail_disabled" };
  }

  const transporter = createTransporter();
  const from = process.env.MAIL_FROM;
  const subject =
    process.env.MAIL_ORDER_PAID_SUBJECT || `Twoje zamowienie ${order.order_number} zostalo oplacone`;
  const currency = order.currency || "PLN";
  const html = renderTemplate("order-paid.html", {
    customerFullName: order.customer_full_name,
    orderNumber: order.order_number,
    createdAt: new Date(order.created_at).toLocaleString("pl-PL"),
    paymentMethod: order.payment_method,
    deliveryMethod: order.delivery_method,
    itemsRows: buildOrderItemsRowsHtml(items, currency),
    subtotalAmount: formatMoney(order.subtotal_amount),
    discountAmount: formatMoney(order.discount_amount),
    shippingAmount: formatMoney(order.shipping_amount),
    finalAmount: formatMoney(order.final_amount),
    currency,
  });
  const text = [
    `Dziekujemy za zamowienie ${order.order_number}.`,
    "Platnosc zostala potwierdzona.",
    `Kwota: ${formatMoney(order.final_amount)} ${currency}`,
  ].join("\n");

  const info = await transporter.sendMail({
    from,
    to: order.customer_email,
    subject,
    html,
    text,
  });

  return {
    sent: true,
    messageId: info?.messageId || null,
    accepted: info?.accepted || [],
    rejected: info?.rejected || [],
    response: info?.response || null,
  };
};

module.exports = {
  sendNewsletterWelcomeEmail,
  sendOrderPaidEmail,
};
