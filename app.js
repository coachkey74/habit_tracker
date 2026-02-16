const STORAGE_KEY = "habit_tracker_v1";

const habitForm = document.querySelector("#habitForm");
const habitNameInput = document.querySelector("#habitName");
const messageEl = document.querySelector("#message");
const habitListEl = document.querySelector("#habitList");
const emptyStateEl = document.querySelector("#emptyState");
const clearDataBtn = document.querySelector("#clearDataBtn");
const filterChips = document.querySelectorAll(".chip");

let state = {
  habits: [],
  filter: "active", // active | all | archived
};

function toISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    if (!parsed || !Array.isArray(parsed.habits)) return;

    state.habits = parsed.habits;
    state.filter = parsed.filter || "active";
  } catch (err) {
    console.warn("Failed to load habits:", err);
  }
}

function save() {
  const payload = {
    habits: state.habits,
    filter: state.filter,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function setMessage(text) {
  messageEl.textContent = text;
}

function normalizeName(name) {
  return name.trim().replace(/\s+/g, " ");
}

function addHabit(name) {
  const habit = {
    id: uid(),
    name,
    createdAt: new Date().toISOString(),
    archived: false,
    completions: [],
  };
  state.habits.unshift(habit);
  save();
  render();
}

function toggleDoneToday(id) {
  const today = toISODate();
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;

  const idx = habit.completions.indexOf(today);
  if (idx >= 0) {
    habit.completions.splice(idx, 1);
  } else {
    habit.completions.push(today);
  }

  habit.completions.sort();
  save();
  render();
}

function archiveHabit(id) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;

  habit.archived = true;
  save();
  render();
}

function restoreHabit(id) {
  const habit = state.habits.find((h) => h.id === id);
  if (!habit) return;

  habit.archived = false;
  save();
  render();
}

function deleteHabit(id) {
  state.habits = state.habits.filter((h) => h.id !== id);
  save();
  render();
}

function calculateStreak(completions) {
  // completions: array of "YYYY-MM-DD"
  if (!Array.isArray(completions) || completions.length === 0) return 0;

  const done = new Set(completions);
  let streak = 0;

  // Count backwards from today while consecutive days exist
  let cursor = new Date();
  while (true) {
    const key = toISODate(cursor);
    if (!done.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function formatCreated(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getFilteredHabits() {
  if (state.filter === "all") return state.habits;
  if (state.filter === "archived") return state.habits.filter((h) => h.archived);
  return state.habits.filter((h) => !h.archived); // active
}

function setActiveChip() {
  filterChips.forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.filter === state.filter);
  });
}

function render() {
  setActiveChip();

  const habits = getFilteredHabits();
  habitListEl.innerHTML = "";

  emptyStateEl.style.display = habits.length === 0 ? "block" : "none";

  habits.forEach((habit) => {
    const today = toISODate();
    const doneToday = habit.completions.includes(today);
    const streak = calculateStreak(habit.completions);

    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <div class="cardHeader">
        <div>
          <h3 class="title">${escapeHtml(habit.name)}</h3>
          <p class="meta">Created: ${escapeHtml(formatCreated(habit.createdAt))}</p>
          <p class="meta">
            Streak: <strong>${streak}</strong> day${streak === 1 ? "" : "s"}
            ${doneToday ? `<span class="badge success" style="margin-left:8px;">Done today</span>` : ""}
          </p>
        </div>
        <span class="badge">${habit.archived ? "Archived" : "Active"}</span>
      </div>

      <div class="cardActions">
        <button class="btn small success" data-action="toggle" data-id="${habit.id}">
          ${doneToday ? "Undo today" : "Mark done today"}
        </button>

        ${
          habit.archived
            ? `<button class="btn small" data-action="restore" data-id="${habit.id}">Restore</button>`
            : `<button class="btn small" data-action="archive" data-id="${habit.id}">Archive</button>`
        }

        <button class="btn small danger" data-action="delete" data-id="${habit.id}">
          Delete
        </button>
      </div>
    `;

    habitListEl.appendChild(card);
  });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// Events
habitForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const raw = habitNameInput.value;
  const name = normalizeName(raw);

  if (!name) {
    setMessage("Type a habit first.");
    habitNameInput.focus();
    return;
  }

  const exists = state.habits.some((h) => h.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    setMessage("That habit already exists.");
    habitNameInput.value = "";
    habitNameInput.focus();
    return;
  }

  addHabit(name);
  setMessage("Habit added.");
  habitNameInput.value = "";
  habitNameInput.focus();
});

habitListEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  if (!action || !id) return;

  if (action === "toggle") toggleDoneToday(id);
  if (action === "archive") archiveHabit(id);
  if (action === "restore") restoreHabit(id);
  if (action === "delete") deleteHabit(id);
});

filterChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    state.filter = chip.dataset.filter;
    save();
    render();
  });
});

clearDataBtn.addEventListener("click", () => {
  const ok = confirm("Clear ALL habits? This cannot be undone.");
  if (!ok) return;

  state.habits = [];
  save();
  render();
  setMessage("Cleared.");
});

// Init
load();
render();