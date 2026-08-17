const QUOTES = [
  "Small actions repeated daily build extraordinary results.",
  "Consistency beats intensity when habits become identity.",
  "Progress is quiet, but streaks make it visible.",
  "You do not need a perfect day, just a completed next step.",
  "Momentum grows every time you show up for yourself.",
  "One check-in today is a promise kept to tomorrow."
];

const BADGE_DEFINITIONS = [
  {
    key: "spark",
    name: "Spark Starter",
    icon: "✨",
    description: "Complete 5 habit check-ins.",
    type: "completions",
    threshold: 5
  },
  {
    key: "week",
    name: "7-Day Flame",
    icon: "🔥",
    description: "Reach a 7-day streak.",
    type: "streak",
    threshold: 7
  },
  {
    key: "month",
    name: "30-Day Legend",
    icon: "🏆",
    description: "Reach a 30-day streak.",
    type: "streak",
    threshold: 30
  },
  {
    key: "century",
    name: "Consistency Century",
    icon: "💯",
    description: "Log 100 total completions.",
    type: "completions",
    threshold: 100
  }
];

function getRandomQuote() {
  const index = Math.floor(Math.random() * QUOTES.length);
  return QUOTES[index];
}

function buildBadges(habits, totalCompletions) {
  const topStreak = habits.reduce(
    (maximum, habit) => Math.max(maximum, habit.longestStreak || 0),
    0
  );

  return BADGE_DEFINITIONS.map((badge) => {
    const progress =
      badge.type === "streak" ? topStreak : totalCompletions;

    return {
      ...badge,
      unlocked: progress >= badge.threshold,
      progress: Math.min(progress, badge.threshold),
      progressPercent: Math.min(
        Math.round((progress / badge.threshold) * 100),
        100
      )
    };
  });
}

module.exports = {
  buildBadges,
  getRandomQuote
};
