


const express = require("express");
const { register, login } = require("../controllers/authController");
const { upload } = require("../controllers/authController"); // export upload too if needed
const router = express.Router();

router.post("/register", upload.single("profilePic"), register);
router.post("/login", login);

module.exports = router;









