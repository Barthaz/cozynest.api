require("dotenv").config();

const app = require("./app");
const pool = require("./config/db");

const PORT = Number(process.env.PORT || 4000);

const startServer = async () => {
  try {
    await pool.query("SELECT 1");
    console.log("Database connection established.");

    app.listen(PORT, () => {
      console.log(`API is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to database. Server startup aborted.");
    console.error({
      code: error?.code || null,
      sqlState: error?.sqlState || null,
      message: error?.message || "Unknown database error",
    });
    process.exit(1);
  }
};

startServer();
