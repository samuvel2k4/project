const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const pool = require("../db");  // adjust if your db file is elsewhere
require("dotenv").config();

//-------------------------------------------
//  NODE MAILER SETUP
//-------------------------------------------
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

//-------------------------------------------
//  FORGOT PASSWORD
//-------------------------------------------
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

//-------------------------------------------
//  RESET PASSWORD
//-------------------------------------------
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
      return res.status(400).json({ error: "Invalid or expired token" });

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

module.exports = router;
