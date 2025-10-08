// server.js
require("dotenv").config()
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/authRoutes");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// health check
app.get("/", (req, res) => res.json({ message: "API is running" }));

// routes
app.use("", authRoutes);

// test DB connection
db.query("SELECT NOW()")
  .then(() => console.log("✅ Database connected"))
  .catch((err) => {
    console.error("❌ Database connection error:", err.message);
    process.exit(1);
  });

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
