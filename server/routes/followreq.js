const express = require("express");
const router = express.Router();
const pool = require("../db");

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


module.exports = router;
