require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const authRoutes = require("./routes/authRoutes");
const db = require("./db");
const { serveProfilePics } = require("./controllers/authController");
const followRoutes = require("./routes/follow");
const usersRoutes = require("./routes/Users");
const followReqRoutes = require("./routes/followreq"); 
const passwordroute = require("./routes/passwordroute");


const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Serve profile pictures statically
serveProfilePics(app);

// health check
app.get("/", (req, res) => res.json({ message: "API is running" }));

// routes
app.use("", authRoutes);

// Routes
app.use("/", followRoutes);

app.use("/users", usersRoutes);

app.use("/following", followRoutes);

app.use("/followreq", followReqRoutes);

app.use("/", passwordroute);


// test DB connection
db.query("SELECT NOW()")
  .then(() => console.log("✅ Database connected"))
  .catch((err) => {
    console.error("❌ Database connection error:", err.message);
    process.exit(1);
  });

app.listen(PORT, () => console.log(`🚀 Servers running on http://localhost:${PORT}`));
