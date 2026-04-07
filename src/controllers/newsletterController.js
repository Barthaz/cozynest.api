const pool = require("../config/db");

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    return res.status(201).json({
      message: "Newsletter subscription created.",
      data: {
        id: result.insertId,
        email: normalizedEmail,
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
};
