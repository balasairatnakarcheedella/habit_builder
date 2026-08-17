function startOfDay(dateInput = new Date()) {
  const date = new Date(dateInput);
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateKey(dateKey) {
  return startOfDay(new Date(`${dateKey}T12:00:00`));
}

function formatDateKey(dateInput = new Date()) {
  const date = startOfDay(dateInput);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateInput, amount) {
  const date = startOfDay(dateInput);
  date.setDate(date.getDate() + amount);
  return date;
}

function differenceInDays(left, right) {
  const milliseconds = startOfDay(left).getTime() - startOfDay(right).getTime();
  return Math.round(milliseconds / (24 * 60 * 60 * 1000));
}

function getWeekStart(dateInput = new Date()) {
  const date = startOfDay(dateInput);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function addWeeks(dateInput, amount) {
  return addDays(dateInput, amount * 7);
}

function isSameDay(left, right) {
  return formatDateKey(left) === formatDateKey(right);
}

module.exports = {
  addDays,
  addWeeks,
  differenceInDays,
  formatDateKey,
  getWeekStart,
  isSameDay,
  parseDateKey,
  startOfDay
};
