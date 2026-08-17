const {
  addDays,
  addWeeks,
  differenceInDays,
  formatDateKey,
  getWeekStart,
  parseDateKey
} = require("./date");

function uniqueSortedDateKeys(dateKeys) {
  return [...new Set(dateKeys)].sort();
}

function randomAccent() {
  const palette = [
    "#f7b35c",
    "#ffc46f",
    "#59c7bf",
    "#76ddd4",
    "#d89252",
    "#3e8f88"
  ];
  return palette[Math.floor(Math.random() * palette.length)];
}

function getCurrentStreakFromAnchor(sortedKeys, anchorKey, unit = "day") {
  if (!anchorKey) {
    return 0;
  }

  const keySet = new Set(sortedKeys);

  if (!keySet.has(anchorKey)) {
    return 0;
  }

  let streak = 0;
  let cursor = parseDateKey(anchorKey);

  while (keySet.has(formatDateKey(cursor))) {
    streak += 1;
    cursor = unit === "week" ? addWeeks(cursor, -1) : addDays(cursor, -1);
  }

  return streak;
}

function getLongestStreak(sortedKeys, unit = "day") {
  if (!sortedKeys.length) {
    return 0;
  }

  let longest = 1;
  let current = 1;

  for (let index = 1; index < sortedKeys.length; index += 1) {
    const currentDate = parseDateKey(sortedKeys[index]);
    const previousDate = parseDateKey(sortedKeys[index - 1]);
    const difference = differenceInDays(currentDate, previousDate);
    const expected = unit === "week" ? 7 : 1;

    if (difference === expected) {
      current += 1;
      longest = Math.max(longest, current);
    } else if (difference > 0) {
      current = 1;
    }
  }

  return longest;
}

function buildDailyHistory(completedSet, frozenSet, today) {
  const history = [];

  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = addDays(today, -offset);
    const dateKey = formatDateKey(date);
    let status = "missed";

    if (completedSet.has(dateKey)) {
      status = "completed";
    } else if (frozenSet.has(dateKey)) {
      status = "frozen";
    } else if (offset === 0) {
      status = "pending";
    }

    history.push({
      dateKey,
      label: date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 1),
      status
    });
  }

  return history;
}

function buildWeeklyHistory(countsByWeek, today, target) {
  const history = [];
  const currentWeekStart = getWeekStart(today);
  const currentWeekKey = formatDateKey(currentWeekStart);

  for (let offset = 7; offset >= 0; offset -= 1) {
    const weekStart = addWeeks(currentWeekStart, -offset);
    const weekKey = formatDateKey(weekStart);
    const count = countsByWeek.get(weekKey) || 0;
    let status = "missed";

    if (count >= target) {
      status = "completed";
    } else if (weekKey === currentWeekKey) {
      status = "pending";
    }

    history.push({
      dateKey: weekKey,
      label: weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric"
      }),
      status,
      count,
      target
    });
  }

  return history;
}

function buildDailyStats(habit, completions, today = new Date()) {
  const todayKey = formatDateKey(today);
  const yesterdayKey = formatDateKey(addDays(today, -1));
  const completedKeys = uniqueSortedDateKeys(completions.map((entry) => entry.dateKey));
  const frozenKeys = uniqueSortedDateKeys(habit.frozenDates || []);
  const successKeys = uniqueSortedDateKeys([...completedKeys, ...frozenKeys]);
  const completedSet = new Set(completedKeys);
  const frozenSet = new Set(frozenKeys);
  const successSet = new Set(successKeys);
  const currentAnchor = successSet.has(todayKey)
    ? todayKey
    : successSet.has(yesterdayKey)
      ? yesterdayKey
      : null;

  const currentStreak = getCurrentStreakFromAnchor(successKeys, currentAnchor, "day");
  const longestStreak = getLongestStreak(successKeys, "day");
  const recentHistory = buildDailyHistory(completedSet, frozenSet, today);
  const recentCompletedCount = recentHistory.filter(
    (entry) => entry.status === "completed" || entry.status === "frozen"
  ).length;
  const completionRate = Math.round((recentCompletedCount / recentHistory.length) * 100);
  const isCompleteToday = successSet.has(todayKey);

  return {
    currentStreak,
    longestStreak,
    completionRate,
    periodProgress: isCompleteToday ? 100 : 0,
    isCompleteToday,
    currentPeriodLabel: isCompleteToday ? "Done for today" : "Ready for today",
    statusMessage: isCompleteToday
      ? "Nice work. Today's streak is protected."
      : currentStreak > 0
        ? "Keep the streak alive with one check-in today."
        : "A fresh streak starts with today's check-in.",
    history: recentHistory,
    totalCompletions: completions.length
  };
}

function buildWeeklyStats(habit, completions, today = new Date()) {
  const todayKey = formatDateKey(today);
  const currentWeekStart = getWeekStart(today);
  const currentWeekKey = formatDateKey(currentWeekStart);
  const previousWeekKey = formatDateKey(addWeeks(currentWeekStart, -1));
  const countsByWeek = new Map();

  for (const completion of completions) {
    const weekKey = formatDateKey(getWeekStart(parseDateKey(completion.dateKey)));
    countsByWeek.set(weekKey, (countsByWeek.get(weekKey) || 0) + 1);
  }

  const successfulWeeks = uniqueSortedDateKeys(
    [...countsByWeek.entries()]
      .filter(([, count]) => count >= habit.weeklyTarget)
      .map(([weekKey]) => weekKey)
  );
  const successfulWeekSet = new Set(successfulWeeks);
  const currentWeekCount = countsByWeek.get(currentWeekKey) || 0;
  const currentAnchor = successfulWeekSet.has(currentWeekKey)
    ? currentWeekKey
    : successfulWeekSet.has(previousWeekKey)
      ? previousWeekKey
      : null;
  const currentStreak = getCurrentStreakFromAnchor(
    successfulWeeks,
    currentAnchor,
    "week"
  );
  const longestStreak = getLongestStreak(successfulWeeks, "week");
  const history = buildWeeklyHistory(countsByWeek, today, habit.weeklyTarget);
  const successfulInHistory = history.filter((entry) => entry.status === "completed").length;
  const completionRate = Math.round((successfulInHistory / history.length) * 100);
  const remaining = Math.max(habit.weeklyTarget - currentWeekCount, 0);
  const todayCompleted = completions.some((completion) => completion.dateKey === todayKey);

  return {
    currentStreak,
    longestStreak,
    completionRate,
    periodProgress: Math.min(
      Math.round((currentWeekCount / habit.weeklyTarget) * 100),
      100
    ),
    isCompleteToday: todayCompleted,
    currentPeriodLabel:
      currentWeekCount >= habit.weeklyTarget
        ? "Weekly target met"
        : `${remaining} check-in${remaining === 1 ? "" : "s"} left this week`,
    statusMessage:
      currentWeekCount >= habit.weeklyTarget
        ? "Strong work. This habit is already on track for the week."
        : "Chip away at the weekly goal to keep momentum going.",
    history,
    weeklyCheckIns: currentWeekCount,
    totalCompletions: completions.length
  };
}

function buildHabitView(habitDocument, completions, today = new Date()) {
  const habit = habitDocument.toObject ? habitDocument.toObject() : { ...habitDocument };
  const stats =
    habit.frequency === "weekly"
      ? buildWeeklyStats(habit, completions, today)
      : buildDailyStats(habit, completions, today);

  return {
    ...habit,
    ...stats
  };
}

module.exports = {
  buildHabitView,
  buildDailyStats,
  buildWeeklyStats,
  randomAccent
};
