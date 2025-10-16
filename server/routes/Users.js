const express = require("express");
const router = express.Router();
const pool = require("../db");

// GET users in chunks
router.get("/users", async (req, res) => {
  try {
    // Extract query params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const loggedInUserId = parseInt(req.query.loggedInUserId);
    const offset = (page - 1) * limit;

    console.log(`[GET /users] loggedInUserId=${loggedInUserId}, page=${page}, limit=${limit}, offset=${offset}`);

    // Set headers for chunked transfer
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Start the response with opening brace and metadata
    res.write('{"page":' + page + ',"limit":' + limit + ',');

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM users WHERE id != $1`,
      [loggedInUserId]
    );
    const total = parseInt(countResult.rows[0].total, 10);
    res.write('"total":' + total + ',"users":[');

    // Stream users data in chunks
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

      // Write each user as a chunk
      const chunk = JSON.stringify(user);
      res.write(chunk);
      
      // Add comma between users, but not after the last one
      if (index < usersResult.rows.length - 1) {
        res.write(',');
      }
    });

    // Close the JSON array and object
    res.write(']}');
    res.end();

  } catch (err) {
    console.error("Backend error fetching users:", err);
    
    // If headers not sent yet, send error response
    if (!res.headersSent) {
      res.status(500).json({ message: "Server error fetching users" });
    } else {
      // If already streaming, just end the response
      res.end();
    }
  }
});

// =======================
// PUT update user
// =======================
router.put("/:id", async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { username, email, accountType, loggedInUserId } = req.body;

  if (loggedInUserId !== userId) {
    return res.status(403).json({ message: "You can only update your own profile" });
  }

  try {
    const result = await pool.query(
      `UPDATE users 
       SET name=$1, email=$2, accounttype=$3
       WHERE id=$4
       RETURNING id, name AS username, email, accounttype, profile_pic`,
      [username, email, accountType, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const updatedUser = result.rows[0];
    updatedUser.accountType = updatedUser.accounttype; // normalize

    res.json(updatedUser);
  } catch (err) {
    console.error("Update user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get("/:id", async (req, res) => {
  const userId = parseInt(req.params.id, 10);

  try {
    const result = await pool.query(
      `SELECT id, name AS username, email, profile_pic, accounttype FROM users WHERE id=$1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];
    user.accountType = user.accounttype; // normalize for frontend

    res.json(user);
  } catch (err) {
    console.error("Get user error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
