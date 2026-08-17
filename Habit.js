const mongoose = require("mongoose");

const habitSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      trim: true,
      default: ""
    },
    category: {
      type: String,
      required: true,
      trim: true,
      default: "General"
    },
    frequency: {
      type: String,
      enum: ["daily", "weekly"],
      default: "daily"
    },
    weeklyTarget: {
      type: Number,
      min: 1,
      max: 7,
      default: 3
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium"
    },
    freezeCredits: {
      type: Number,
      default: 1,
      min: 0
    },
    frozenDates: {
      type: [String],
      default: []
    },
    currentStreak: {
      type: Number,
      default: 0
    },
    longestStreak: {
      type: Number,
      default: 0
    },
    accentColor: {
      type: String,
      default: "#ff8c42"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Habit", habitSchema);
