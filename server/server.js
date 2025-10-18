require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const db = require("./db");
const controlroute= ("./route/controlroute");
const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// health check
app.get("/", (req, res) => res.json({ message: "API is running" }));

// routes
app.get("/api", controlroute);

// test DB connection
db.query("SELECT NOW()")
  .then(() => console.log("✅ Database connected"))
  .catch((err) => {
    console.error("❌ Database connection error:", err.message);
    process.exit(1);
  });

app.listen(PORT, () => console.log(`🚀 Servers running on http://localhost:${PORT}`));
