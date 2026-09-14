// Date helpers, carried over from the design canvas unchanged.
// Everything is noon-anchored so that daylight-saving shifts can never move a
// deadline across a midnight boundary.

export function d(s) {
  const p = String(s).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
}

export function iso(dt) {
  return (
    dt.getFullYear() +
    '-' + String(dt.getMonth() + 1).padStart(2, '0') +
    '-' + String(dt.getDate()).padStart(2, '0')
  );
}

export function today(now = Date.now()) {
  const t = new Date(now);
  t.setHours(12, 0, 0, 0);
  return t;
}

export function fmt(s) {
  if (!s) return 'no date';
  return d(s).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function fmtShort(s) {
  if (!s) return '—';
  return d(s).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export function daysTo(s, now = Date.now()) {
  if (!s) return null;
  return Math.round((d(s) - today(now)) / 86400000);
}

export function shift(s, n) {
  const dt = d(s);
  dt.setDate(dt.getDate() + n);
  return iso(dt);
}

/** Every Friday inside the term — the practice-block grid. */
export function fridays(termStart, termEnd) {
  const out = [];
  const dt = d(termStart);
  while (dt.getDay() !== 5) dt.setDate(dt.getDate() + 1);
  const end = d(termEnd);
  while (dt <= end) {
    out.push(iso(dt));
    dt.setDate(dt.getDate() + 7);
  }
  return out;
}

export function hm(mins) {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function nowIsoDate(now = Date.now()) {
  return iso(today(now));
}
