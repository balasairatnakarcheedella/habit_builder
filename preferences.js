const express = require("express");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.patch("/", async (req, res, next) => {
  try {
    const updates = req.body || {};
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const currentPreferences = user.preferences?.toObject?.() || user.preferences || {};
    const currentReminders =
      user.preferences?.reminders?.toObject?.() || user.preferences?.reminders || {};

    user.preferences = {
      ...currentPreferences,
      ...updates,
      reminders: {
        ...currentReminders,
        ...(updates.reminders || {})
      }
    };

    await user.save();

    res.json({
      message: "Preferences updated.",
      preferences: user.preferences
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
