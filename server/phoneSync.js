// Phone sync: push a trimmed copy of the deck to the phone app on Vercel.
//
// Off unless phone.local.json exists — without it this module does nothing
// and the deck stays entirely local, as it always was.
//
// The laptop is the only source of truth; the phone only reads. So sync is
// one-way and whole-state: after any change, the laptop sends a fresh
// snapshot and the phone's copy is replaced.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { APP_ROOT } from './db.js';
import { buildState } from './state.js';

const CONFIG_PATH = path.join(APP_ROOT, 'phone.local.json');

export function phoneConfig() {
  try {
    const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return c && c.url && c.syncToken ? { url: String(c.url).replace(/\/+$/, ''), syncToken: String(c.syncToken) } : null;
  } catch {
    return null;
  }
}

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

// Settings the phone needs to plan and rank exactly as the laptop does.
const SETTINGS = [
  'termStart', 'termEnd', 'termCalendarConfirmed', 'lastScannedAt',
  'slipDays', 'stuckMinutes', 'minErrorsAtT14', 'examHorizonDays', 'minutesPerErrorReview',
  'dayStartMin', 'dayEndMin', 'dailyTargetHours', 'weekendTargetHours',
  'minBlockMinutes', 'maxBlockMinutes', 'breakMinutes', 'classBufferMinutes',
  'planHorizonDays', 'urgentSlackDays', 'focusHoursPerDay',
];

/**
 * What leaves the laptop. An allowlist, not a blocklist: a field added to the
 * state later stays home until someone decides it should travel.
 *
 * Never sent: source snippets and file paths (course content), the text of
 * error-log entries and weekly reflections, escalation contacts (TA names),
 * unconfirmed dates, the review queue and conflicts.
 */
export function buildSnapshot(state = buildState()) {
  return {
    v: 1,
    syncedAt: new Date().toISOString(),
    courses: state.courses.map((c) => pick(c, ['id', 'code', 'title', 'examCourse', 'weightsKnown', 'sortOrder'])),
    components: state.components
      .filter((c) => c.status === 'todo' || c.status === 'done')
      .map((c) => ({
        ...pick(c, ['id', 'courseId', 'title', 'weight', 'estHours', 'kind', 'status', 'droppable', 'trap', 'free', 'note']),
        // Only confirmed dates travel. A proposal belongs to the review queue,
        // which lives on the laptop.
        dueDate: c.userConfirmed ? c.dueDate : null,
        userConfirmed: !!c.userConfirmed,
        confidence: c.userConfirmed ? 'high' : 'low',
        dateIsEstimate: false,
      })),
    classBlocks: state.classBlocks.map((b) => pick(b, ['id', 'courseId', 'weekday', 'startMin', 'endMin', 'kind'])),
    termWeeks: state.termWeeks.map((w) => pick(w, ['weekNumber', 'startDate', 'endDate', 'isReadingWeek'])),
    settings: pick(state.settings, SETTINGS),
    planLog: state.planLog.map((r) => pick(r, ['date', 'slotKey', 'taskId', 'courseId', 'minutes'])),
    taskWork: state.taskWork.map((w) => pick(w, ['taskId', 'before', 'total'])),
    // How many, per course and when — never what.
    errors: state.errors.map((e) => ({ id: e.id, courseId: e.courseId, date: e.date, topic: '', whatIGotWrong: '' })),
    // Open stuck concepts, because an old one becomes an "Unblock" block.
    concepts: state.concepts
      .filter((c) => c.status === 'open')
      .map((c) => pick(c, ['id', 'courseId', 'description', 'openedAt', 'resolvedAt', 'status', 'rungs', 'fromStuckTimer'])),
    sessions: state.sessions.map((s) => ({ ...pick(s, ['id', 'courseId', 'date', 'minutes', 'type']), note: '' })),
    // File names only — the plan says which document to open. No paths.
    materials: state.materials.map((m) => pick(m, ['courseId', 'name', 'kind', 'mtime'])),
    conflicts: [],
  };
}

/* ── scheduling ─────────────────────────────────────────────────────────── */

const status = { lastSyncAt: null, lastError: null, lastAttemptAt: null };
let timer = null;
let lastHash = null;
let inFlight = false;

export function syncStatus() {
  const cfg = phoneConfig();
  return { enabled: !!cfg, url: cfg?.url || null, ...status };
}

/**
 * Sync soon. Every mutation calls this; a burst of edits collapses into one
 * upload a few seconds after the last of them.
 */
export function scheduleSync(delayMs = 4000) {
  if (!phoneConfig()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), delayMs);
  timer.unref?.();
}

export async function syncNow({ force = false } = {}) {
  const cfg = phoneConfig();
  if (!cfg) return syncStatus();
  if (inFlight) {
    scheduleSync(2000);
    return syncStatus();
  }

  const snap = buildSnapshot();
  // Hash everything but the timestamp: an unchanged deck is not re-uploaded,
  // which keeps well inside the storage plan's write allowance.
  const { syncedAt, ...content } = snap;
  const hash = crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  if (!force && hash === lastHash) return syncStatus();

  inFlight = true;
  status.lastAttemptAt = new Date().toISOString();
  try {
    const res = await fetch(`${cfg.url}/api/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.syncToken}` },
      body: JSON.stringify(snap),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`${res.status} ${detail}`.slice(0, 240));
    }
    lastHash = hash;
    status.lastSyncAt = syncedAt;
    status.lastError = null;
  } catch (e) {
    status.lastError = e.message || String(e);
    // Offline, or Vercel hiccupped: try again in five minutes.
    scheduleSync(5 * 60 * 1000);
  } finally {
    inFlight = false;
  }
  return syncStatus();
}
