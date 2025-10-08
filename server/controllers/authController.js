// controllers/authController.js
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs =require("fs");
const path = require("path");


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
 

// REGISTER USER (no token here)
async function register(req, res) {
  try {
    const { name, address, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    // check if email exists
    const exists = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // hash password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

      const result = await db.query(
      `INSERT INTO users (name, email, password, address, profile_pic) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, address, profile_pic, created_at`,
      [name, email, hashed, address, req.file.filename]
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

// LOGIN USER (creates token)
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

    // check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // create token only on login
    const token = jwt.sign({ userName: user.name, useremail: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" });

    return res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
}

module.exports = { register, login, upload};
