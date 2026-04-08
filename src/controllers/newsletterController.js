const pool = require("../config/db");
const { sendNewsletterWelcomeEmail } = require("../services/mailService");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sendTestNewsletterEmail = async (req, res) => {
  const { email } = req.query;

  if (!email || typeof email !== "string" || !emailRegex.test(email)) {
    return res.status(400).json({
      error: "Invalid email query param.",
      expected: "/api/newsletter/send-test-email?email=example@domain.com",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const emailResult = await sendNewsletterWelcomeEmail(normalizedEmail);

    if (!emailResult.sent) {
      return res.status(400).json({
        error: "Email sending is disabled.",
        details: emailResult.reason || null,
      });
    }

    return res.status(200).json({
      message: "Test email sent successfully.",
      data: {
        email: normalizedEmail,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to send test email.",
      details: error?.message || "Unknown email error.",
    });
  }
};

const subscribeToNewsletter = async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string" || !emailRegex.test(email)) {
    return res.status(400).json({
      error: "Invalid email address.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const [existingRows] = await pool.execute(
      "SELECT id FROM newsletter_subscribers WHERE email = ? LIMIT 1",
      [normalizedEmail]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        error: "Email is already subscribed to the newsletter.",
      });
    }

    const [result] = await pool.execute(
      "INSERT INTO newsletter_subscribers (email) VALUES (?)",
      [normalizedEmail]
    );

    try {
      const emailResult = await sendNewsletterWelcomeEmail(normalizedEmail);

      if (!emailResult.sent) {
        await pool.execute("DELETE FROM newsletter_subscribers WHERE id = ?", [
          result.insertId,
        ]);

        return res.status(502).json({
          error: "Newsletter subscription failed. Welcome email was not sent.",
          details: emailResult.reason || "mail_not_sent",
        });
      }
    } catch (mailError) {
      await pool.execute("DELETE FROM newsletter_subscribers WHERE id = ?", [
        result.insertId,
      ]);

      console.error("Newsletter email send error:", {
        code: mailError?.code,
        message: mailError?.message,
      });

      return res.status(502).json({
        error: "Newsletter subscription failed. Welcome email was not sent.",
        details: mailError?.message || "Failed to send welcome email.",
      });
    }

    return res.status(201).json({
      message: "Newsletter subscription created.",
      data: {
        id: result.insertId,
        email: normalizedEmail,
        emailSent: true,
      },
    });
  } catch (error) {
    const details =
      error?.message || error?.sqlMessage || error?.code || String(error);

    console.error("Newsletter subscribe error:", {
      code: error?.code,
      errno: error?.errno,
      sqlState: error?.sqlState,
      message: error?.message,
      sqlMessage: error?.sqlMessage,
    });

    return res.status(500).json({
      error: "Internal server error.",
      details,
    });
  }
};

module.exports = {
  subscribeToNewsletter,
  sendTestNewsletterEmail,
};
