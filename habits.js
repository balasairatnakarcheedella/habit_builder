const express = require("express");
const Habit = require("../models/Habit");
const Completion = require("../models/Completion");
const { requireAuth } = require("../middleware/auth");
const { formatDateKey } = require("../utils/date");
const { buildHabitView, randomAccent } = require("../utils/habit-stats");

const router = express.Router();

router.use(requireAuth);

async function hydrateHabit(habit, userId) {
  const completions = await Completion.find({
    user: userId,
    habit: habit._id
  }).sort({ dateKey: 1 });

  const view = buildHabitView(habit, completions);

  if (
    habit.currentStreak !== view.currentStreak ||
    habit.longestStreak !== view.longestStreak
  ) {
    habit.currentStreak = view.currentStreak;
    habit.longestStreak = view.longestStreak;
    await habit.save();
  }

  return view;
}

router.get("/", async (req, res, next) => {
  try {
    const habits = await Habit.find({ user: req.user._id }).sort({
      createdAt: -1
    });

    const items = [];

    for (const habit of habits) {
      items.push(await hydrateHabit(habit, req.user._id));
    }

    res.json({ habits: items });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      title,
      description = "",
      category = "General",
      frequency = "daily",
      weeklyTarget = 3,
      difficulty = "medium"
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Habit title is required." });
    }

    const habit = await Habit.create({
      user: req.user._id,
      title,
      description,
      category,
      frequency,
      weeklyTarget: frequency === "weekly" ? weeklyTarget : 3,
      difficulty,
      accentColor: randomAccent()
    });

    const view = await hydrateHabit(habit, req.user._id);
    res.status(201).json({ message: "Habit created.", habit: view });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const habit = await Habit.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    const fields = ["title", "description", "category", "frequency", "difficulty"];

    for (const field of fields) {
      if (field in req.body) {
        habit[field] = req.body[field];
      }
    }

    if ("weeklyTarget" in req.body) {
      habit.weeklyTarget = req.body.weeklyTarget;
    }

    await habit.save();
    const view = await hydrateHabit(habit, req.user._id);
    res.json({ message: "Habit updated.", habit: view });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const habit = await Habit.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    await Completion.deleteMany({ habit: habit._id, user: req.user._id });
    res.json({ message: "Habit deleted." });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/toggle", async (req, res, next) => {
  try {
    const habit = await Habit.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    const dateKey = req.body.dateKey || formatDateKey(new Date());
    const existingCompletion = await Completion.findOne({
      habit: habit._id,
      user: req.user._id,
      dateKey
    });

    if (existingCompletion) {
      await existingCompletion.deleteOne();
    } else {
      await Completion.create({
        habit: habit._id,
        user: req.user._id,
        dateKey
      });

      habit.frozenDates = (habit.frozenDates || []).filter((entry) => entry !== dateKey);
      await habit.save();
    }

    const view = await hydrateHabit(habit, req.user._id);

    res.json({
      message: existingCompletion ? "Habit unchecked for that day." : "Habit completed.",
      habit: view
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/freeze", async (req, res, next) => {
  try {
    const habit = await Habit.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found." });
    }

    if (habit.frequency !== "daily") {
      return res
        .status(400)
        .json({ message: "Streak freeze is available for daily habits only." });
    }

    const dateKey = req.body.dateKey || formatDateKey(new Date());
    const alreadyCompleted = await Completion.exists({
      habit: habit._id,
      user: req.user._id,
      dateKey
    });

    if (alreadyCompleted) {
      return res.status(400).json({ message: "This habit is already completed for today." });
    }

    if ((habit.frozenDates || []).includes(dateKey)) {
      return res.status(400).json({ message: "Streak freeze already used for today." });
    }

    if (habit.freezeCredits < 1) {
      return res.status(400).json({ message: "No streak freezes remaining." });
    }

    habit.freezeCredits -= 1;
    habit.frozenDates = [...(habit.frozenDates || []), dateKey];
    await habit.save();

    const view = await hydrateHabit(habit, req.user._id);
    res.json({
      message: "Streak freeze applied for today.",
      habit: view
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
