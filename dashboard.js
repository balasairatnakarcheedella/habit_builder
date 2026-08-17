const express = require("express");
const Habit = require("../models/Habit");
const Completion = require("../models/Completion");
const { requireAuth } = require("../middleware/auth");
const { addDays, formatDateKey } = require("../utils/date");
const { buildHabitView } = require("../utils/habit-stats");
const { buildBadges, getRandomQuote } = require("../utils/motivation");

const router = express.Router();

router.use(requireAuth);

async function getDashboardPayload(userId) {
  const habits = await Habit.find({ user: userId }).sort({ createdAt: -1 });
  const completions = await Completion.find({ user: userId }).sort({ dateKey: 1 });
  const completionsByHabit = new Map();

  for (const completion of completions) {
    const key = completion.habit.toString();
    const list = completionsByHabit.get(key) || [];
    list.push(completion);
    completionsByHabit.set(key, list);
  }

  const habitViews = habits.map((habit) =>
    buildHabitView(habit, completionsByHabit.get(habit._id.toString()) || [])
  );

  for (const habit of habits) {
    const view = habitViews.find((entry) => entry._id.toString() === habit._id.toString());

    if (
      habit.currentStreak !== view.currentStreak ||
      habit.longestStreak !== view.longestStreak
    ) {
      habit.currentStreak = view.currentStreak;
      habit.longestStreak = view.longestStreak;
      await habit.save();
    }
  }

  const totalHabits = habitViews.length;
  const dailyProgressPercent = totalHabits
    ? Math.round(
        habitViews.reduce((sum, habit) => sum + habit.periodProgress, 0) / totalHabits
      )
    : 0;
  const todayKey = formatDateKey(new Date());
  const completedToday = habitViews.filter((habit) => habit.isCompleteToday).length;
  const activeStreaks = habitViews.filter((habit) => habit.currentStreak > 0).length;
  const longestStreak = habitViews.reduce(
    (max, habit) => Math.max(max, habit.longestStreak || 0),
    0
  );
  const totalCompletions = completions.length;
  const badges = buildBadges(habitViews, totalCompletions);
  const recentCompletions = completions.filter((completion) => {
    const cutoff = formatDateKey(addDays(new Date(), -29));
    return completion.dateKey >= cutoff;
  }).length;

  return {
    quote: getRandomQuote(),
    summary: {
      todayKey,
      totalHabits,
      completedToday,
      dailyProgressPercent,
      activeStreaks,
      longestStreak,
      totalCompletions,
      recentCompletions
    },
    badges,
    habits: habitViews
  };
}

function buildAnalyticsSeries(habits, completions) {
  const today = new Date();
  const last7Days = [];
  const last30Days = [];
  const completionCounts = new Map();
  const categoryCounts = new Map();

  for (const completion of completions) {
    completionCounts.set(
      completion.dateKey,
      (completionCounts.get(completion.dateKey) || 0) + 1
    );
  }

  for (const habit of habits) {
    categoryCounts.set(
      habit.category,
      (categoryCounts.get(habit.category) || 0) + habit.totalCompletions
    );
  }

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const dateKey = formatDateKey(date);
    last7Days.push({
      label: date.toLocaleDateString("en-US", { weekday: "short" }),
      value: completionCounts.get(dateKey) || 0
    });
  }

  for (let offset = 29; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const dateKey = formatDateKey(date);
    last30Days.push({
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: completionCounts.get(dateKey) || 0
    });
  }

  const topHabits = [...habits]
    .sort((left, right) => right.currentStreak - left.currentStreak)
    .slice(0, 5)
    .map((habit) => ({
      label: habit.title,
      value: habit.currentStreak
    }));

  return {
    weekly: last7Days,
    monthly: last30Days,
    categories: [...categoryCounts.entries()].map(([label, value]) => ({
      label,
      value
    })),
    streaks: topHabits
  };
}

router.get("/", async (req, res, next) => {
  try {
    const payload = await getDashboardPayload(req.user._id);
    res.json(payload);
  } catch (error) {
    next(error);
  }
});

router.get("/analytics", async (req, res, next) => {
  try {
    const habits = await Habit.find({ user: req.user._id }).sort({ createdAt: -1 });
    const completions = await Completion.find({ user: req.user._id }).sort({ dateKey: 1 });
    const completionMap = new Map();

    for (const completion of completions) {
      const key = completion.habit.toString();
      const list = completionMap.get(key) || [];
      list.push(completion);
      completionMap.set(key, list);
    }

    const habitViews = habits.map((habit) =>
      buildHabitView(habit, completionMap.get(habit._id.toString()) || [])
    );

    res.json({
      analytics: buildAnalyticsSeries(habitViews, completions)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
