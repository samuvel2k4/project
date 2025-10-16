const express = require("express");
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();
const nodemailer= require("nodemailer")

const SALT_ROUNDS = 10;


// Ensure uploads folder exists
const uploadDir = path.join(__dirname, "..", "userprofilepic");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + "-" + file.originalname;
    cb(null, uniqueName);
  },
});

// Only allow JPEG & PNG
function fileFilter(req, file, cb) {
  if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG or PNG files are allowed!"), false);
  }
}

const upload = multer({ storage, fileFilter });

// ================= REGISTER USER =================
async function register(req, res) {
  try {
    const { name, address, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    // Check if email exists
    const exists = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // Handle profile pic safely
    const profilePic = req.file ? req.file.filename : null;

    const result = await db.query(
      `INSERT INTO users (name, email, password, address, profile_pic) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, address, profile_pic, created_at`,
      [name, email, hashed, address, profilePic]
    );

    const user = result.rows[0];

    return res.status(201).json({
      message: "Registered successfully. Please log in.",
      user,
    });
  } catch (err) {
    console.error("Register error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
}

// ================= GET ALL USERS =================
async function getUsers(req, res) {
  try {
    const result = await db.query(
      "SELECT id, name, email, address, accountType, profile_pic, created_at FROM users"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get users error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
}

// ================= SERVE PROFILE PICS =================
function serveProfilePics(app) {
  const uploadDir = path.join(__dirname, "..", "userprofilepic");
 
  // Apply CORS headers specifically to static files
  app.use("/profile", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*"); // allow all origins
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin"); // optional but helps
    next();
  }, express.static(uploadDir));
}

// ================= LOGIN USER =================
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // Create token
    const token = jwt.sign({ name: user.name, email: user.email}, process.env.JWT_SECRET, { expiresIn: "24h" });

    return res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, profile_pic: user.profile_pic },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
}

//===========================================
//  NODE MAILER SETUP
//===========================================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "samuvel240904@gmail.com",
    pass: "sam@2004" ,
  }
});

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    // 1. Find user by email
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: "Invalid userId" });

    const user = userResult.rows[0];

    // 2. Generate JWT token valid for 1 hour
    const token = jwt.sign({ userId: user.id }, "SECRET_KEY", { expiresIn: "1h" });

    const expires = new Date(Date.now() + 3600000); // 1 hour from now

    // 3. Save token in password_reset_tokens table
    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.id, token, expires]
    );

    // 4. Send email with reset link
    const resetLink = `http://localhost:3000/reset-password?token=${token}`;
    await transporter.sendMail({
      from: "samuvel240904@gmail.com",
      to: user.email,
      subject: "Password Reset",
      html: `<p>We received a request to reset your password. Click the button below to proceed:</p>

<p class="text-center">
  <a href="${resetLink}" class="btn btn-primary btn-lg">Reset Password</a>
</p>

<p>If you did not request a password reset, please ignore this email.</p>
`
    });

    res.json({ message: "Reset link sent to your email" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// -------------------- Reset Password --------------------
app.post("/resetpassword", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) return res.status(400).json({ error: "Token and new password are required" });

  try {
    // 1. Validate token exists and not expired
    const tokenResult = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()",
      [token]
    );
    if (tokenResult.rows.length === 0) return res.status(400).json({ error: "Invalid or expired token" });

    const userId = tokenResult.rows[0].user_id;

    // 2. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 3. Update user's password
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, userId]);

    // 4. Delete used token
    await pool.query("DELETE FROM password_reset_tokens WHERE token = $1", [token]);

    res.json({ message: "Password reset successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = { register, login, upload, getUsers, serveProfilePics };
