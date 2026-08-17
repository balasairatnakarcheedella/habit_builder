const mongoose = require("mongoose");

const completionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    habit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Habit",
      required: true
    },
    dateKey: {
      type: String,
      required: true
    },
    completedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

completionSchema.index({ habit: 1, dateKey: 1 }, { unique: true });
completionSchema.index({ user: 1, dateKey: 1 });

module.exports = mongoose.model("Completion", completionSchema);
