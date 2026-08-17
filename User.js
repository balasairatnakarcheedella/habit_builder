const mongoose = require("mongoose");

const reminderSchema = new mongoose.Schema(
  {
    enabled: {
      type: Boolean,
      default: false
    },
    time: {
      type: String,
      default: "20:00"
    }
  },
  { _id: false }
);

const preferenceSchema = new mongoose.Schema(
  {
    darkMode: {
      type: Boolean,
      default: false
    },
    reminders: {
      type: reminderSchema,
      default: () => ({})
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    preferences: {
      type: preferenceSchema,
      default: () => ({})
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
