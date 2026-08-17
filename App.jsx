import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const initialHabit = {
  _id: "",
  title: "",
  description: "",
  category: "Health",
  difficulty: "medium",
  frequency: "daily",
  weeklyTarget: 3
};

const categories = ["Health", "Study", "Fitness", "Mindfulness", "Work", "Creative", "General"];
const TOAST_TIMEOUT = 3200;

function getErrorMessage(error) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || "Request failed.");
  }

  return payload;
}

function AuthView({ onAuthenticated, pushToast }) {
  const [mode, setMode] = useState("login");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);

    try {
      const formData = new FormData(event.currentTarget);
      const payload = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(formData.entries()))
      });

      onAuthenticated(payload.user);
      pushToast(mode === "login" ? "Logged in successfully." : "Account created successfully.");
    } catch (error) {
      pushToast(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-view">
      <div className="hero-panel panel">
        <p className="eyebrow">Habit Builder + Streak Tracker</p>
        <h1>Build momentum you can see every day.</h1>
        <p className="hero-copy">
          Track routines, protect streaks, review progress, and keep your next small win close.
        </p>
        <div className="feature-list">
          <Feature title="Live streak tracking" text="Daily and weekly habits with missed-day history." />
          <Feature title="Visual analytics" text="Weekly bars, monthly trends, and category balance." />
          <Feature title="Motivation built in" text="Badges, reminders, quotes, and streak freezes." />
        </div>
        <div className="momentum-preview" aria-label="Sample weekly habit progress">
          <div className="preview-header">
            <span>Weekly flow</span>
            <strong>5 day streak</strong>
          </div>
          <p className="preview-copy">A quick preview of how your weekly habit momentum will look.</p>
          <div className="preview-rail" aria-hidden="true">
            <span className="complete">M</span>
            <span className="complete">T</span>
            <span className="complete">W</span>
            <span className="today">T</span>
            <span>F</span>
            <span>S</span>
            <span>S</span>
          </div>
          <div className="preview-stats">
            <span>71% this week</span>
            <span>Next: 8:00 PM</span>
          </div>
        </div>
      </div>

      <div className="auth-card panel">
        <div className="tab-switch" aria-label="Authentication mode">
          <button className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
            Login
          </button>
          <button className={mode === "signup" ? "active" : ""} type="button" onClick={() => setMode("signup")}>
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p className="muted">
            {mode === "login" ? "Pick up your streak where you left it." : "Start a dashboard around your routines."}
          </p>

          {mode === "signup" && (
            <label>
              <span>Name</span>
              <input name="name" type="text" placeholder="Your name" required />
            </label>
          )}
          <label>
            <span>Email</span>
            <input name="email" type="email" placeholder="you@example.com" required />
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" placeholder="Minimum 6 characters" required />
          </label>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Working..." : mode === "login" ? "Login" : "Create Account"}
          </button>
        </form>
      </div>
    </section>
  );
}

function Feature({ title, text }) {
  return (
    <article className="feature-item">
      <strong>{title}</strong>
      <p>{text}</p>
    </article>
  );
}

function Dashboard({ user, setUser, pushToast }) {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalHabit, setModalHabit] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const reminderRef = useRef(null);

  const habits = dashboard?.habits || [];
  const summary = dashboard?.summary;

  const onTrack = useMemo(
    () => habits.filter((habit) => (habit.frequency === "weekly" ? habit.periodProgress >= 100 : habit.isCompleteToday)).length,
    [habits]
  );

  const refreshDashboard = useCallback(async () => {
    const [dashboardPayload, analyticsPayload] = await Promise.all([
      api("/api/dashboard"),
      api("/api/dashboard/analytics")
    ]);
    setDashboard(dashboardPayload);
    setAnalytics(analyticsPayload.analytics);
  }, []);

  useEffect(() => {
    refreshDashboard()
      .catch((error) => pushToast(getErrorMessage(error)))
      .finally(() => setLoading(false));
  }, [pushToast, refreshDashboard]);

  useEffect(() => {
    document.body.dataset.theme = user.preferences?.darkMode ? "dark" : "light";

    return () => {
      delete document.body.dataset.theme;
    };
  }, [user.preferences?.darkMode]);

  useEffect(() => {
    if (reminderRef.current) {
      window.clearTimeout(reminderRef.current);
      reminderRef.current = null;
    }

    const reminders = user.preferences?.reminders;
    if (!reminders?.enabled || !reminders?.time) {
      return undefined;
    }

    function scheduleNextReminder() {
      const [hours, minutes] = reminders.time.split(":").map(Number);
      const now = new Date();
      const nextReminder = new Date();
      nextReminder.setHours(hours, minutes, 0, 0);

      if (nextReminder <= now) {
        nextReminder.setDate(nextReminder.getDate() + 1);
      }

      reminderRef.current = window.setTimeout(() => {
        const message = "Your habits are waiting. A tiny check-in keeps the streak alive.";
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("Habit Builder Reminder", { body: message });
        }
        pushToast(message);
        scheduleNextReminder();
      }, nextReminder.getTime() - now.getTime());
    }

    scheduleNextReminder();

    return () => {
      if (reminderRef.current) {
        window.clearTimeout(reminderRef.current);
      }
    };
  }, [pushToast, user.preferences?.reminders]);

  async function savePreferences(preferences) {
    const payload = await api("/api/preferences", {
      method: "PATCH",
      body: JSON.stringify(preferences)
    });
    setUser((current) => ({ ...current, preferences: payload.preferences }));
    return payload;
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      setUser(null);
      delete document.body.dataset.theme;
      pushToast("Logged out.");
    } catch (error) {
      pushToast(getErrorMessage(error));
    }
  }

  function openHabitModal(habit = null) {
    setModalHabit(habit || initialHabit);
    setIsModalOpen(true);
  }

  async function habitAction(action, habit) {
    try {
      if (action === "edit") {
        openHabitModal(habit);
        return;
      }

      if (action === "delete" && !window.confirm(`Delete "${habit.title}"?`)) {
        return;
      }

      const config = {
        toggle: { url: `/api/habits/${habit._id}/toggle`, method: "POST", message: "Habit updated for today." },
        freeze: { url: `/api/habits/${habit._id}/freeze`, method: "POST", message: "Streak freeze applied." },
        delete: { url: `/api/habits/${habit._id}`, method: "DELETE", message: "Habit deleted." }
      }[action];

      await api(config.url, {
        method: config.method,
        body: config.method === "DELETE" ? undefined : JSON.stringify({})
      });
      await refreshDashboard();
      pushToast(config.message);
    } catch (error) {
      pushToast(getErrorMessage(error));
    }
  }

  if (loading) {
    return <div className="panel loading-state">Loading your dashboard...</div>;
  }

  return (
    <section className="app-view">
      <header className="topbar panel">
        <div>
          <p className="eyebrow">Your daily system</p>
          <h2>Welcome back, {user.name}</h2>
          <p className="muted">{dashboard?.quote || "Small actions repeated daily build extraordinary results."}</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="ghost-button theme-button" onClick={() => savePreferences({ darkMode: !user.preferences?.darkMode }).catch((error) => pushToast(getErrorMessage(error)))}>
            <span className="button-icon" aria-hidden="true">{user.preferences?.darkMode ? "☀" : "◐"}</span>
            {user.preferences?.darkMode ? "Light mode" : "Dark mode"}
          </button>
          <button type="button" className="ghost-button" onClick={() => openHabitModal()}>
            New habit
          </button>
          <button type="button" className="ghost-button" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <StatsGrid summary={summary} />

      <section className="content-grid">
        <div className="main-column">
          <section className="section-panel panel spotlight-card">
            <div>
              <p className="eyebrow">Daily progress</p>
              <h3>{habits.length ? `${onTrack} of ${habits.length} habits are on track right now.` : "Start your first habit and build a visible routine."}</h3>
            </div>
            <div className="spotlight-meta">
              <span>{summary?.completedToday || 0} done today</span>
              <span>{summary?.dailyProgressPercent || 0}% progress</span>
              <span>{summary?.longestStreak || 0} longest streak</span>
            </div>
          </section>

          <section className="section-panel panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Habit board</p>
                <h3>All habits</h3>
              </div>
              <button className="secondary-button" type="button" onClick={() => openHabitModal()}>
                Add habit
              </button>
            </div>
            <HabitGrid habits={habits} onAction={habitAction} />
          </section>
        </div>

        <aside className="side-column">
          <Badges badges={dashboard?.badges || []} />
          <ReminderForm preferences={user.preferences || {}} savePreferences={savePreferences} pushToast={pushToast} />
        </aside>
      </section>

      <Analytics analytics={analytics} isDarkMode={Boolean(user.preferences?.darkMode)} />

      {isModalOpen && (
        <HabitModal
          habit={modalHabit}
          onClose={() => setIsModalOpen(false)}
          onSaved={async (message) => {
            setIsModalOpen(false);
            await refreshDashboard();
            pushToast(message);
          }}
          pushToast={pushToast}
        />
      )}
    </section>
  );
}

function StatsGrid({ summary }) {
  const cards = [
    ["Daily progress", `${summary?.dailyProgressPercent || 0}%`, `${summary?.completedToday || 0}/${summary?.totalHabits || 0} habits completed today`, "progress"],
    ["Active streaks", String(summary?.activeStreaks || 0), "Habits currently carrying momentum", "streak"],
    ["Longest streak", `${summary?.longestStreak || 0} streak`, "Best streak across all habits", "peak"],
    ["Total check-ins", String(summary?.totalCompletions || 0), `${summary?.recentCompletions || 0} completed over the last 30 days`, "check"]
  ];

  return (
    <section className="stats-grid">
      {cards.map(([label, value, hint, tone]) => (
        <article className="stat-card panel" key={label}>
          <div className={`stat-orb ${tone}`} aria-hidden="true" />
          <p className="eyebrow">{label}</p>
          <strong>{value}</strong>
          <p className="muted">{hint}</p>
        </article>
      ))}
    </section>
  );
}

function HabitGrid({ habits, onAction }) {
  if (!habits.length) {
    return (
      <div className="empty-state">
        <p>No habits yet.</p>
        <p>Create one to start tracking streaks, badges, and progress charts.</p>
      </div>
    );
  }

  return (
    <div className="habit-grid">
      {habits.map((habit) => (
        <HabitCard habit={habit} key={habit._id} onAction={onAction} />
      ))}
    </div>
  );
}

function HabitCard({ habit, onAction }) {
  const missedCount = habit.history.filter((entry) => entry.status === "missed").length;
  const streakUnit = habit.frequency === "weekly" ? "weeks" : "days";

  return (
    <article className="habit-card" style={{ "--card-accent": habit.accentColor }}>
      <div className="habit-top">
        <div>
          <div className="meta-row">
            <span>{habit.category}</span>
            <span>{habit.frequency}</span>
            <span>{habit.difficulty}</span>
          </div>
          <h4>{habit.title}</h4>
          <p className="habit-description">{habit.description || "No description added yet."}</p>
        </div>
        <button className="icon-button" type="button" aria-label={`Edit ${habit.title}`} onClick={() => onAction("edit", habit)}>
          ✎
        </button>
      </div>

      <div className="habit-metrics">
        <Metric label="Current streak" value={habit.currentStreak} hint={streakUnit} />
        <Metric label="Longest streak" value={habit.longestStreak} hint={streakUnit} />
        <Metric label="Completion rate" value={`${habit.completionRate}%`} hint={`${missedCount} missed recently`} />
      </div>

      <p className="muted">{habit.currentPeriodLabel}</p>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${habit.periodProgress}%` }} />
      </div>
      <p className="microcopy">{habit.statusMessage}</p>

      <p className="history-title">{habit.frequency === "weekly" ? "Last 8 weeks" : "Last 14 days"}</p>
      <div className="history-strip">
        {habit.history.map((entry) => (
          <span className={`history-cell ${entry.status} ${habit.frequency === "weekly" ? "weekly" : ""}`} title={`${entry.dateKey} - ${entry.status}`} key={entry.dateKey}>
            {habit.frequency === "weekly" ? `${entry.count}/${entry.target}` : entry.label}
          </span>
        ))}
      </div>

      <div className="action-row">
        <button className="chip-button success" type="button" onClick={() => onAction("toggle", habit)}>
          {habit.isCompleteToday ? "Undo today" : habit.frequency === "weekly" ? "Log today" : "Complete today"}
        </button>
        {habit.frequency === "daily" && (
          <button className="chip-button warning" type="button" disabled={habit.freezeCredits < 1 || habit.isCompleteToday} onClick={() => onAction("freeze", habit)}>
            Freeze ({habit.freezeCredits})
          </button>
        )}
        <button className="chip-button danger" type="button" onClick={() => onAction("delete", habit)}>
          Delete
        </button>
      </div>
    </article>
  );
}

function Metric({ label, value, hint }) {
  return (
    <div className="metric-box">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function Badges({ badges }) {
  return (
    <section className="section-panel panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Achievements</p>
          <h3>Badges</h3>
        </div>
      </div>
      <div className="badge-list">
        {badges.length ? (
          badges.map((badge) => (
            <article className={`badge-card ${badge.unlocked ? "" : "locked"}`} key={badge.name}>
              <strong>{badge.name}</strong>
              <p className="muted">{badge.description}</p>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${badge.progressPercent}%` }} />
              </div>
              <p className="microcopy">{badge.unlocked ? "Unlocked" : `${badge.progress}/${badge.threshold} progress`}</p>
            </article>
          ))
        ) : (
          <div className="empty-state">Badges will appear as soon as your streaks start growing.</div>
        )}
      </div>
    </section>
  );
}

function ReminderForm({ preferences, savePreferences, pushToast }) {
  const reminders = preferences.reminders || { enabled: false, time: "20:00" };
  const [enabled, setEnabled] = useState(Boolean(reminders.enabled));
  const [time, setTime] = useState(reminders.time || "20:00");

  useEffect(() => {
    setEnabled(Boolean(reminders.enabled));
    setTime(reminders.time || "20:00");
  }, [reminders.enabled, reminders.time]);

  async function submit(event) {
    event.preventDefault();

    try {
      if (enabled && "Notification" in window && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          pushToast("Notification permission was not granted.");
        }
      }

      await savePreferences({ reminders: { enabled, time } });
      pushToast("Reminder settings saved.");
    } catch (error) {
      pushToast(getErrorMessage(error));
    }
  }

  return (
    <section className="section-panel panel">
      <div className="section-header">
        <div>
          <p className="eyebrow">Reminders</p>
          <h3>Daily nudge</h3>
        </div>
      </div>
      <form className="reminder-form" onSubmit={submit}>
        <label className="toggle-row">
          <span>Enable browser reminder</span>
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
        </label>
        <label>
          <span>Reminder time</span>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </label>
        <button className="secondary-button" type="submit">
          Save reminder
        </button>
      </form>
      <p className="microcopy">Browser reminders work while this app stays open in a tab.</p>
    </section>
  );
}

function HabitModal({ habit, onClose, onSaved, pushToast }) {
  const [form, setForm] = useState(() => ({ ...initialHabit, ...habit }));

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    const body = {
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      difficulty: form.difficulty,
      frequency: form.frequency,
      weeklyTarget: Number(form.weeklyTarget || 3)
    };

    try {
      await api(form._id ? `/api/habits/${form._id}` : "/api/habits", {
        method: form._id ? "PATCH" : "POST",
        body: JSON.stringify(body)
      });
      await onSaved(form._id ? "Habit updated." : "Habit created.");
    } catch (error) {
      pushToast(getErrorMessage(error));
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-card panel">
        <div className="section-header">
          <div>
            <p className="eyebrow">Habit editor</p>
            <h3>{form._id ? "Edit habit" : "Create habit"}</h3>
          </div>
          <button className="icon-button" type="button" aria-label="Close habit editor" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="habit-form" onSubmit={submit}>
          <label>
            <span>Habit name</span>
            <input type="text" maxLength="60" value={form.title} onChange={(event) => update("title", event.target.value)} required />
          </label>
          <label>
            <span>Description</span>
            <textarea rows="3" value={form.description} placeholder="Why does this matter to you?" onChange={(event) => update("description", event.target.value)} />
          </label>
          <div className="form-row">
            <label>
              <span>Category</span>
              <select value={form.category} onChange={(event) => update("category", event.target.value)}>
                {categories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Difficulty</span>
              <select value={form.difficulty} onChange={(event) => update("difficulty", event.target.value)}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>Frequency</span>
              <select value={form.frequency} onChange={(event) => update("frequency", event.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            {form.frequency === "weekly" && (
              <label>
                <span>Weekly target</span>
                <input type="number" min="1" max="7" value={form.weeklyTarget} onChange={(event) => update("weeklyTarget", event.target.value)} />
              </label>
            )}
          </div>
          <button className="primary-button" type="submit">
            Save habit
          </button>
        </form>
      </div>
    </div>
  );
}

function Analytics({ analytics, isDarkMode }) {
  const weeklyRef = useRef(null);
  const monthlyRef = useRef(null);
  const categoryRef = useRef(null);
  const chartsRef = useRef([]);

  useEffect(() => {
    if (!analytics || !window.Chart) {
      return undefined;
    }

    chartsRef.current.forEach((chart) => chart.destroy());
    chartsRef.current = [];

    const labelColor = getComputedStyle(document.body).getPropertyValue("--muted").trim();
    const gridColor = getComputedStyle(document.body).getPropertyValue("--chart-grid").trim();
    const weeklyData = analytics.weekly.map((item) => item.value);
    const monthlyData = analytics.monthly.map((item) => item.value);
    const categoryLabels = analytics.categories.length ? analytics.categories.map((item) => item.label) : ["No data yet"];
    const categoryData = analytics.categories.length ? analytics.categories.map((item) => item.value) : [1];
    const categoryColors = analytics.categories.length
      ? ["#ff9838", "#2aa39a", "#ffc173", "#45c1b5", "#8fa29b", "#dc7620"]
      : [isDarkMode ? "#213a35" : "#eee7dc"];

    chartsRef.current = [
      new window.Chart(weeklyRef.current, {
        type: "bar",
        data: {
          labels: analytics.weekly.map((item) => item.label),
          datasets: [{ data: weeklyData, borderRadius: 6, backgroundColor: "rgba(255, 152, 56, 0.92)" }]
        },
        options: chartOptions(labelColor, gridColor)
      }),
      new window.Chart(monthlyRef.current, {
        type: "line",
        data: {
          labels: analytics.monthly.map((item) => item.label),
          datasets: [{ data: monthlyData, tension: 0.35, borderWidth: 3, borderColor: "rgba(42, 163, 154, 0.95)", pointRadius: 2, fill: true, backgroundColor: "rgba(42, 163, 154, 0.14)" }]
        },
        options: chartOptions(labelColor, gridColor)
      }),
      new window.Chart(categoryRef.current, {
        type: "doughnut",
        data: {
          labels: categoryLabels,
          datasets: [{ data: categoryData, backgroundColor: categoryColors, borderWidth: 0 }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "bottom", labels: { color: labelColor, usePointStyle: true, padding: 18 } } }
        }
      })
    ];

    return () => {
      chartsRef.current.forEach((chart) => chart.destroy());
      chartsRef.current = [];
    };
  }, [analytics, isDarkMode]);

  return (
    <section className="analytics-grid">
      <ChartPanel title="Weekly completion flow" canvasRef={weeklyRef} />
      <ChartPanel title="Monthly momentum" canvasRef={monthlyRef} />
      <ChartPanel title="Category mix" canvasRef={categoryRef} />
    </section>
  );
}

function chartOptions(labelColor, gridColor) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: labelColor } },
      x: { grid: { display: false }, ticks: { color: labelColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 7 } }
    }
  };
}

function ChartPanel({ title, canvasRef }) {
  return (
    <section className="section-panel panel chart-card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Analytics</p>
          <h3>{title}</h3>
        </div>
      </div>
      <div className="chart-frame">
        <canvas ref={canvasRef} />
      </div>
    </section>
  );
}

function Toasts({ toasts }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((message) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, TOAST_TIMEOUT);
  }, []);

  useEffect(() => {
    api("/api/auth/me")
      .then((payload) => setUser(payload.user))
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  return (
    <>
      <main className="shell">
        {checkingAuth ? (
          <div className="panel loading-state">Checking your session...</div>
        ) : user ? (
          <Dashboard user={user} setUser={setUser} pushToast={pushToast} />
        ) : (
          <AuthView onAuthenticated={setUser} pushToast={pushToast} />
        )}
      </main>
      <Toasts toasts={toasts} />
    </>
  );
}
