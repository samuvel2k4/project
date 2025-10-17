const express = require("express");
const router = express.Router();
const pool = require("../db");

// =======================
// GET users (paginated, excluding logged-in user)
// =======================
router.get("/users", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const loggedInUserId = parseInt(req.query.loggedInUserId);
    const offset = (page - 1) * limit;

    console.log(`[GET /users] loggedInUserId=${loggedInUserId}, page=${page}, limit=${limit}, offset=${offset}`);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Transfer-Encoding", "chunked");

    res.write('{"page":' + page + ',"limit":' + limit + ',');

    // Get total users count (excluding logged-in user)
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM users WHERE id != $1`,
      [loggedInUserId]
    );
    const total = parseInt(countResult.rows[0].total, 10);
    res.write('"total":' + total + ',"users":[');

    // Fetch paginated users
    const usersResult = await pool.query(
      `SELECT *
       FROM users
       WHERE id != $1
       ORDER BY id DESC
       LIMIT $2 OFFSET $3`,
      [loggedInUserId, limit, offset]
    );

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
      const chunk = JSON.stringify(user);
      res.write(chunk);
      if (index < usersResult.rows.length - 1) res.write(",");
    });

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
