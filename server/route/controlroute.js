const express= require("express");
const router = express.Router();
const db = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const nodemailer= require("nodemailer");


const SALT_ROUNDS = 10;

// upload directory file if exists
const uploadDir = path.join(__dirname, "..", "userprofilepic");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer storage setup for image
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
router.post("/register", upload.single("profile_pic"), async (req, res) => {
  try {
    const { name, address, email, password, phoneno, accountType } = req.body;

    if (!name || !email || !password || !phoneno || !address) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check if email exists
    const exists = await db.query("SELECT id FROM users WHERE email = $1", [email]);
    if (exists.rows.length > 0) {
      return res.status(409).json({ message: "Email already registered" });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    // Handle profile pic
    const profilePic = req.file ? req.file.filename : null;

    const result = await db.query(
      `INSERT INTO users (name, email, password, address, profile_pic, phoneno, accounttype)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, email, address, profile_pic, phoneno, accounttype, created_at`,
      [name, email, hashed, address, profilePic, phoneno, accountType]
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
});

// ================= LOGIN USER =====================
router.post("/login", async (req, res) => {
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

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid password" });
    }
// creating token
    const token = jwt.sign({ name: user.name, email: user.email }, process.env.JWT_SECRET, { expiresIn: "24h" });
//returning as a json 
    return res.json({
      message: "Login successful",
      token,
      user: { id: user.id, name: user.name, email: user.email, profile_pic: user.profile_pic },
    });
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
});

// ================NODE MAILER SETUP=================

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});


// =================FORGOT PASSWORD===================

router.post("/forgotpassword", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const userResult = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userResult.rows.length === 0)
      return res.status(400).json({ error: "Invalid userId" });

    const user = userResult.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const expires = new Date(Date.now() + 3600000);

    await pool.query(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)",
      [user.id, token, expires]
    );

    const resetLink = `http://localhost:5173/reset-password?token=${token}`;
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset",
      html: `
        <p>We received a request to reset your password.</p>
        <p><a href="${resetLink}" style="background:#007bff;color:white;padding:10px 20px;text-decoration:none;">Reset Password</a></p>
        <p>If you didn’t request this, please ignore this email.</p>
      `,
    });

    res.json({ message: "Reset link sent to your email" });
  } 
  catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================RESET PASSWORD===================

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword)
    return res.status(400).json({ error: "Token and new password are required" });

  try {
    const tokenResult = await pool.query(
      "SELECT * FROM password_reset_tokens WHERE token = $1 AND expires_at > NOW()",
      [token]
    );

    if (tokenResult.rows.length === 0)
      return res.status(400).json({ error: "Token has been expired try again the request" });

    const userId = tokenResult.rows[0].user_id;
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [hashedPassword, userId]);
    await pool.query("DELETE FROM password_reset_tokens WHERE token = $1", [token]);

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ================= GET ALL USERS ===================

router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const offset = (page - 1) * limit;
    const loggedInUserId = req.user.id; // extracted from token

    // Start JSON response (chunked)
    res.write('{"page":' + page + ',"limit":' + limit + ',"users":[');

    // Fetch paginated users excluding logged-in user
    const usersResult = await pool.query(
      `SELECT id, name, email, address, accounttype, profile_pic, created_at
       FROM users
       WHERE id != $1
       ORDER BY id ASC
       LIMIT $2 OFFSET $3`,
      [loggedInUserId, limit, offset]
    );

    // Stream each user as JSON chunk
    usersResult.rows.forEach((u, index) => {
      const user = {
        id: u.id,
        name: u.name,
        email: u.email,
        address: u.address,
        accounttype: u.accounttype,
        profile_pic: u.profile_pic,
        created_at: u.created_at,
      };
      res.write(JSON.stringify(user));
      if (index < usersResult.rows.length - 1) res.write(",");
    });

    // Close JSON array and object
    res.write("]}");
    res.end();
  } catch (err) {
    console.error("Backend error fetching users:", err);
    if (!res.headersSent) {
      res.status(500).json({ message: "Server error fetching users" });
    } else {
      res.end();
    }
  }
});


const parseIntParam = (param) => {
  const parsed = Number(param);
  return Number.isNaN(parsed) ? null : parsed;
};

// --------------------
// Follow / Unfollow a user
// --------------------
router.post("/follow", async (req, res) => {
  const { userId, targetId, action, isRequest } = req.body;

  const uid = parseIntParam(userId);
  const tid = parseIntParam(targetId);

  if (!uid || !tid || !action)
    return res.status(400).json({ success: false, message: "Missing or invalid fields" });

  try {
    // -----------------------------
    // FOLLOW AGAIN AFTER REJECTION
    // -----------------------------
    const rejected = await db.query(
      "SELECT * FROM follows WHERE user_id=$1 AND target_id=$2 AND status='rejected'",
      [uid, tid]
    );

    if (rejected.rows.length > 0) {
      await db.query(
        "UPDATE follows SET status='pending', created_at=NOW() WHERE id=$1",
        [rejected.rows[0].id]
      );
      return res.json({ success: true, message: "Follow request sent again", status: "pending" });
    }
    // -----------------------------

    if (action === "unfollow") {
      await db.query(
        "DELETE FROM follows WHERE user_id=$1 AND target_id=$2",
        [uid, tid]
      );
      return res.json({ success: true, message: "Unfollowed / Request cancelled" });
    }

    const status = isRequest ? "pending" : "accepted";

    const result = await db.query(
      `INSERT INTO follows (user_id, target_id, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, target_id) DO NOTHING
       RETURNING *`,
      [uid, tid, status]
    );

    if (result.rowCount === 0)
      return res.json({ success: false, message: isRequest ? "Request already sent" : "Already following" });

    res.json({ success: true, message: isRequest ? "Follow request sent" : "Now following", status });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// --------------------
// Get all following & pending requests for a user
// --------------------

router.get("/:userId", async (req, res) => {
  const userId = parseIntParam(req.params.userId);
  if (!userId) return res.status(400).json({ error: "Invalid userId" });

  try {
    const result = await db.query(
      "SELECT id, target_id, status FROM follows WHERE user_id = $1",
      [userId]
    );

    const following = result.rows
      .filter(r => r.status === "accepted")
      .map(r => r.target_id);

    const pendingRequests = result.rows
      .filter(r => r.status === "pending")
      .map(r => ({ id: r.id, targetId: r.target_id }));

    res.json({ following, pendingRequests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// --------------------
// Accept follow request
// --------------------
router.put("/accept/:requestId", async (req, res) => {
  const requestId = parseIntParam(req.params.requestId);
  if (!requestId) return res.status(400).json({ success: false, message: "Invalid requestId" });

  try {
    const result = await db.query(
      "UPDATE follows SET status='accepted' WHERE id=$1 AND status='pending' RETURNING *",
      [requestId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ success: false, message: "Request not found or already accepted" });

    res.json({ success: true, message: "Request accepted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --------------------
// Reject follow request
// --------------------
router.delete("/reject/:requestId", async (req, res) => {
  const requestId = parseIntParam(req.params.requestId);
  if (!requestId) return res.status(400).json({ success: false, message: "Invalid requestId" });

  try {
    const result = await db.query(
      "DELETE FROM follows WHERE id=$1 AND status='pending'",
      [requestId]
    );

    if (result.rowCount === 0)
      return res.status(404).json({ success: false, message: "Request not found or already handled" });

    res.json({ success: true, message: "Request rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// --------------------
// Get all pending incoming requests for a user
// --------------------
router.get("/pending/:userId", async (req, res) => {
  const userId = parseIntParam(req.params.userId);
  if (!userId) return res.status(400).json({ error: "Invalid userId" });

  try {
    const result = await db.query(
      `SELECT f.id,
              f.user_id AS requester_id,
              u.name AS requester_name,
              u.email AS requester_email,
              f.created_at
       FROM follows f
       JOIN users u ON f.user_id = u.id
       WHERE f.target_id = $1 AND f.status = 'pending'
       ORDER BY f.created_at DESC`,
      [userId]
    );

    res.json({ pendingRequests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});



// ------------------
// Pending requests
// ------------------
router.get("/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });

  try {
    const result = await pool.query(
      `SELECT f.id, u.id AS requester_id, u.name AS username, u.profile_pic
       FROM follows f
       JOIN users u ON f.user_id = u.id
       WHERE f.target_id = $1 AND f.status = 'pending'`,
      [userId]
    );
    res.json({ pendingRequests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------
// Approve request
// ------------------
router.post("/handle/:requestId", async (req, res) => {
  const requestId = Number(req.params.requestId);
  const { ownerId, action } = req.body; // action = 'approve' or 'reject'

  if (!requestId || !ownerId || !action) {
    return res.status(400).json({ message: "Missing or invalid fields" });
  }

  if (!["approve", "reject"].includes(action)) {
    return res.status(400).json({ message: "Invalid action. Must be 'approve' or 'reject'" });
  }

  try {
    let statusToUpdate = action === "approve" ? "accepted" : "rejected";

    const result = await pool.query(
      `UPDATE follows
       SET status=$1, created_at=NOW()
       WHERE id=$2 AND target_id=$3
       RETURNING *`,
      [statusToUpdate, requestId, ownerId]
    );

    if (!result.rows.length) return res.status(404).json({ message: "Follow request not found" });

    res.json({ message: action === "approve" ? "Request approved" : "Request rejected" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ------------------
// Followers count
// ------------------

// GET full followers list
// GET followers list
// Followers list with chunked streaming
router.get("/followers/list/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 3;
  const offset = (page - 1) * limit;

  try {
    // Set headers for chunked transfer
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Start JSON object
    res.write(`{"page":${page},"limit":${limit},`);

    // Get total followers count
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM follows f
       WHERE f.target_id = $1 AND f.status='accepted'`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10);
    res.write(`"total":${total},"followers":[`);

    // Stream followers in chunks
    const followersResult = await pool.query(
      `SELECT u.id, u.name AS username, u.profile_pic,
              CASE WHEN f2.status='accepted' THEN true ELSE false END AS "isFollowing"
       FROM follows f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN follows f2 ON f2.user_id = $2 AND f2.target_id = u.id AND f2.status='accepted'
       WHERE f.target_id = $1 AND f.status='accepted'
       ORDER BY u.id DESC
       LIMIT $3 OFFSET $4`,
      [userId, userId, limit, offset]
    );

    followersResult.rows.forEach((f, index) => {
      res.write(JSON.stringify(f));
      if (index < followersResult.rows.length - 1) res.write(',');
    });

    res.write(']}');
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});

// Following list with chunked streaming
router.get("/following/list/:userId", async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 3;
  const offset = (page - 1) * limit;

  try {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.write(`{"page":${page},"limit":${limit},`);

    // Get total following count
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total 
       FROM follows f
       WHERE f.user_id = $1 AND f.status='accepted'`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].total, 10);
    res.write(`"total":${total},"following":[`);

    const followingResult = await pool.query(
      `SELECT u.id, u.name AS username, u.profile_pic,
              CASE WHEN f2.status='accepted' THEN true ELSE false END AS "isFollowing"
       FROM follows f
       JOIN users u ON f.target_id = u.id
       LEFT JOIN follows f2 ON f2.user_id = $2 AND f2.target_id = u.id AND f2.status='accepted'
       WHERE f.user_id = $1 AND f.status='accepted'
       ORDER BY u.id DESC
       LIMIT $3 OFFSET $4`,
      [userId, userId, limit, offset]
    );

    followingResult.rows.forEach((f, index) => {
      res.write(JSON.stringify(f));
      if (index < followingResult.rows.length - 1) res.write(',');
    });

    res.write(']}');
    res.end();
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
});


// =======================
// PUT update user
// =======================
router.put("/:id", async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { username, email, accountType, phoneNo, address, loggedInUserId } = req.body;

  console.log("[PUT /users/:id] Request body:", req.body);

  // ✅ Fix: convert loggedInUserId to number before comparison
  if (parseInt(loggedInUserId, 10) !== userId) {
    return res.status(403).json({ message: "You can only update your own profile" });
  }

  try {
    const result = await pool.query(
      `UPDATE users 
       SET name = $1, email = $2, accounttype = $3, phoneno = $4, address = $5
       WHERE id = $6
       RETURNING id, name AS username, email, accounttype, profile_pic, phoneno, address`,
      [username, email, accountType, phoneNo, address, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = result.rows[0];
    updatedUser.accountType = updatedUser.accounttype; // normalize key
    updatedUser.phoneNo = updatedUser.phoneno;

    console.log("[PUT /users/:id] User updated:", updatedUser);
    res.json(updatedUser);
  } catch (err) {
    console.error("Update user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// =======================
// GET single user by ID
// =======================
router.get("/:id", async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  try {
    const result = await pool.query(
      `SELECT id, name AS username, email, profile_pic, accounttype, phoneno, address 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    user.accountType = user.accounttype;
    user.phoneNo = user.phoneno || "";
    user.address = user.address || "";

    res.json(user);
  } catch (err) {
    console.error("Get user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;






