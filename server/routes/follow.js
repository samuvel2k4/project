const express = require("express");
const router = express.Router();
const db = require("../db");

// --------------------
// Helper: validate integer
// --------------------
const parseIntParam = (param) => {
  const parsed = Number(param);
  return Number.isNaN(parsed) ? null : parsed;
};

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

module.exports = router;
