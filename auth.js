const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const {
  buildToken,
  clearAuthCookie,
  requireAuth,
  setAuthCookie
} = require("../middleware/auth");

const router = express.Router();

function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    preferences: user.preferences,
    createdAt: user.createdAt
  };
}

router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long." });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(409).json({ message: "An account already exists for this email." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email,
      passwordHash
    });

    const token = buildToken(user._id.toString());
    setAuthCookie(res, token);

    return res.status(201).json({
      message: "Account created successfully.",
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = buildToken(user._id.toString());
    setAuthCookie(res, token);

    return res.json({
      message: "Logged in successfully.",
      user: sanitizeUser(user)
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ message: "Logged out successfully." });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

module.exports = router;
