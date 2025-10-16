const express = require("express");
const { register, login, getUsers} = require("../controllers/authController");
const { upload } = require("../controllers/authController"); // export upload too if needed
const router = express.Router();

router.post("/register", upload.single("profilePic"), register);
router.post("/login", login);
router.get("/users", getUsers);



module.exports = router;

