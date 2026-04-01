const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

// Dummy users (replace with Excel later)
const users = [
  { id: "admin", role: "admin" },
  { id: "user1", role: "user" }
];

router.post("/user-login", (req, res) => {
  const { id } = req.body;

  const user = users.find(u => u.id === id);

  if (!user) {
    return res.status(401).json({ message: "Invalid ID" });
  }

  const token = jwt.sign(user, process.env.JWT_SECRET);

  res.json({ token, role: user.role });
});

module.exports = router;