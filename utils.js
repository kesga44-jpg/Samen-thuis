export const uid = () => (globalThis.crypto?.randomUUID
  ? globalThis.crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export const todayKey = (date = new Date()) => (
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
);

export function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>"']/g, match => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[match]));
}

const pad = value => String(value).padStart(2, '0');
export const parseDate = value => new Date(`${value}T12:00:00`);
export const addDays = (value, amount) => {
  const date = typeof value === 'string' ? parseDate(value) : new Date(value);
  date.setDate(date.getDate() + amount);
  return todayKey(date);
};
export const startOfWeek = value => addDays(value, -((parseDate(value).getDay() + 6) % 7));
export const weekDates = start => Array.from({ length: 7 }, (_, index) => addDays(start, index));
export const daysBetween = (from, to) => Math.round((parseDate(to) - parseDate(from)) / 86400000);

export function parseInputDate(value) {
  const clean = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const match = clean.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  return match ? `${match[3]}-${pad(match[2])}-${pad(match[1])}` : '';
}

export function fmtDate(value, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  const date = value ? parseDate(value) : null;
  return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('nl-NL', options).format(date) : 'Geen datum';
}

export const fmtMoney = value => new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0);

export function toNumber(value) {
  const parsed = Number(String(value ?? '').replace(/[€\s]/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}
