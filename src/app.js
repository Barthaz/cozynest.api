const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const { version } = require("../package.json");

const newsletterRoutes = require("./routes/newsletterRoutes");
const catalogRoutes = require("./routes/catalogRoutes");
const promoCodeRoutes = require("./routes/promoCodeRoutes");
const orderRoutes = require("./routes/orderRoutes");
const stripeWebhookRoutes = require("./routes/stripeWebhookRoutes");

const app = express();

app.use(cors());
app.use("/api/payments", stripeWebhookRoutes);
app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api/db-check", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.status(200).json({
      ok: true,
      message: "Database connection is working.",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      code: error?.code || null,
      sqlState: error?.sqlState || null,
      message: error?.message || "Database connection failed.",
    });
  }
});

app.get("/healthcheck", async (req, res) => {
  let dbStatus = "connected";
  let dbMessage = "Database connection is working.";
  let dbStatusCode = 200;

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    dbStatus = "disconnected";
    dbStatusCode = 503;
    dbMessage = error?.message || "Database connection failed.";
  }

  const statusColor = dbStatus === "connected" ? "#15803d" : "#b91c1c";
  const statusBg = dbStatus === "connected" ? "#dcfce7" : "#fee2e2";

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cozy Nest API Healthcheck</title>
  <style>
    body {
      margin: 0;
      font-family: Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      display: grid;
      place-items: center;
      min-height: 100vh;
    }
    .card {
      width: min(720px, 92vw);
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
      padding: 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 26px;
    }
    .muted {
      margin: 0 0 20px;
      color: #475569;
      font-size: 14px;
    }
    .grid {
      display: grid;
      gap: 12px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 15px;
    }
    .label {
      color: #334155;
    }
    .badge {
      border-radius: 999px;
      padding: 4px 10px;
      font-weight: 700;
      background: ${statusBg};
      color: ${statusColor};
      text-transform: uppercase;
      font-size: 12px;
      letter-spacing: 0.3px;
    }
  </style>
</head>
<body>
  <main class="card">
    <h1>Cozy Nest API</h1>
    <p class="muted">Healthcheck page for operational status.</p>
    <section class="grid">
      <div class="row">
        <span class="label">Server status</span>
        <strong>running</strong>
      </div>
      <div class="row">
        <span class="label">API version</span>
        <strong>${version}</strong>
      </div>
      <div class="row">
        <span class="label">Database status</span>
        <span class="badge">${dbStatus}</span>
      </div>
      <div class="row">
        <span class="label">Database details</span>
        <strong>${dbMessage}</strong>
      </div>
      <div class="row">
        <span class="label">Timestamp</span>
        <strong>${new Date().toISOString()}</strong>
      </div>
    </section>
  </main>
</body>
</html>`;

  return res.status(dbStatusCode).type("html").send(html);
});

app.use("/api", newsletterRoutes);
app.use("/api", catalogRoutes);
app.use("/api", promoCodeRoutes);
app.use("/api", orderRoutes);

module.exports = app;
