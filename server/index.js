import express from 'express';
import { db, seedIfEmpty, backfill, setSetting, SCAN_ROOT, DB_PATH } from './db.js';
import { buildState } from './state.js';
import { runScan } from './scan.js';

const PORT = Number(process.env.DECK_PORT || 5174);

seedIfEmpty();
const filled = backfill();
if (filled.length) console.log(`  backfilled    ${filled.join(' · ')}`);

const app = express();
app.use(express.json({ limit: '1mb' }));

// Localhost only. Nothing here leaves the machine.
const ok = (res, extra = {}) => res.json({ ok: true, state: buildState(), ...extra });
const bad = (res, code, message) => res.status(code).json({ ok: false, error: message });

const nowIso = () => new Date().toISOString();
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const rid = (p) => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* ── GET /api/state ─────────────────────────────────────────────────────── */

app.get('/api/state', (_req, res) => {
  res.json({ ok: true, state: buildState() });
});

/* ── POST /api/scan ─────────────────────────────────────────────────────── */

// Streams newline-delimited JSON: many {type:'progress'} lines while it works,
// then one {type:'done'}. Streaming keeps the live file counter honest without
// needing a second polling endpoint.
let scanning = false;

app.post('/api/scan', async (req, res) => {
  if (scanning) return bad(res, 409, 'A scan is already running.');
  scanning = true;

  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (o) => res.write(`${JSON.stringify(o)}\n`);

  try {
    for await (const ev of runScan({
      parse: req.body?.parse !== false,
      dump: req.body?.dump !== false,
      force: !!req.body?.force,
    })) {
      // `extracted` carries full document text — useful inside the scan, far
      // too heavy to push down the wire.
      const { extracted, ...rest } = ev;
      send(rest);
    }
    send({ type: 'state', state: buildState() });
  } catch (e) {
    console.error('[scan] failed:', e);
    send({ type: 'error', error: e.message });
  } finally {
    scanning = false;
    res.end();
  }
});

/* ── POST /api/tasks  ·  POST /api/tasks/:id ────────────────────────────── */

const TASK_FIELDS = {
  title: (v) => String(v).slice(0, 200),
  weight: (v) => Math.max(0, Number(v) || 0),
  estHours: (v) => Math.max(0.25, Number(v) || 1),
  dueDate: (v) => (v ? String(v).slice(0, 10) : null),
  status: (v) => (['todo', 'done', 'candidate', 'rejected'].includes(v) ? v : 'todo'),
  kind: (v) => (v === 'exam' ? 'exam' : 'work'),
  confidence: (v) => (['high', 'medium', 'low'].includes(v) ? v : 'low'),
  note: (v) => String(v).slice(0, 400),
  droppable: (v) => (v ? 1 : 0),
  trap: (v) => (v ? 1 : 0),
  free: (v) => (v ? 1 : 0),
  userConfirmed: (v) => (v ? 1 : 0),
  dateIsEstimate: (v) => (v ? 1 : 0),
};

app.post('/api/tasks', (req, res) => {
  const b = req.body || {};
  if (!b.courseId || !String(b.title || '').trim()) {
    return bad(res, 400, 'courseId and title are required.');
  }
  const course = db.prepare('SELECT id FROM courses WHERE id = ?').get(b.courseId);
  if (!course) return bad(res, 400, `Unknown course ${b.courseId}.`);

  db.prepare(`
    INSERT INTO components (id, courseId, title, weight, dueDate, confidence,
                            userConfirmed, status, estHours, kind, note, dateIsEstimate)
    VALUES (@id, @courseId, @title, @weight, @dueDate, @confidence,
            @userConfirmed, @status, @estHours, @kind, @note, 0)
  `).run({
    id: rid('c'),
    courseId: b.courseId,
    title: TASK_FIELDS.title(b.title.trim()),
    weight: TASK_FIELDS.weight(b.weight),
    dueDate: TASK_FIELDS.dueDate(b.dueDate),
    // Anything typed in by hand is, by definition, confirmed by hand.
    confidence: 'high',
    userConfirmed: 1,
    status: 'todo',
    estHours: TASK_FIELDS.estHours(b.estHours),
    kind: TASK_FIELDS.kind(b.kind),
    note: TASK_FIELDS.note(b.note || ''),
  });
  ok(res);
});

app.post('/api/tasks/:id', (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM components WHERE id = ?').get(id);
  if (!row) return bad(res, 404, `No component ${id}.`);

  if (req.body?.delete) {
    db.prepare('DELETE FROM components WHERE id = ?').run(id);
    return ok(res);
  }

  // ── review-queue verdicts ───────────────────────────────────────────────
  // Confirming is the only way a scanned date becomes real. Once confirmed it
  // is never overwritten by a later scan; a disagreeing scan raises a conflict.
  if (req.body?.confirm) {
    db.prepare(`
      UPDATE components
      SET userConfirmed = 1, dateIsEstimate = 0, confidence = 'high',
          status = CASE WHEN status = 'candidate' THEN 'todo' ELSE status END,
          weight = COALESCE(@weight, weight),
          estHours = COALESCE(@estHours, estHours),
          dueDate = COALESCE(@dueDate, dueDate),
          title = COALESCE(@title, title),
          updatedAt = datetime('now')
      WHERE id = @id
    `).run({
      id,
      weight: req.body.weight != null ? Math.max(0, Number(req.body.weight) || 0) : null,
      estHours: req.body.estHours != null ? Math.max(0.25, Number(req.body.estHours) || 1) : null,
      dueDate: req.body.dueDate ? String(req.body.dueDate).slice(0, 10) : null,
      title: req.body.title ? String(req.body.title).slice(0, 200) : null,
    });
    return ok(res);
  }

  if (req.body?.reject) {
    if (row.status === 'candidate') {
      // A proposed deliverable that is not real. Kept as 'rejected' rather
      // than deleted so the next scan does not propose it all over again.
      db.prepare("UPDATE components SET status = 'rejected' WHERE id = ?").run(id);
    } else {
      // A proposed date for a real deliverable: drop the date, keep the item.
      db.prepare(`
        UPDATE components
        SET dueDate = NULL, sourceFile = NULL, sourceSnippet = NULL,
            confidence = 'low', userConfirmed = 0, updatedAt = datetime('now')
        WHERE id = ?
      `).run(id);
    }
    return ok(res);
  }

  const patch = {};
  for (const [key, clean] of Object.entries(TASK_FIELDS)) {
    if (key in (req.body || {})) patch[key] = clean(req.body[key]);
  }

  // Setting a date by hand confirms it, and a confirmed date is never an
  // estimate. This is the rule that stops a later scan from overwriting it.
  if ('dueDate' in patch && patch.dueDate) {
    patch.userConfirmed = 1;
    patch.dateIsEstimate = 0;
    patch.confidence = 'high';
  }

  if (!Object.keys(patch).length) return bad(res, 400, 'Nothing to update.');

  const sets = Object.keys(patch).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE components SET ${sets}, updatedAt = @updatedAt WHERE id = @id`)
    .run({ ...patch, id, updatedAt: nowIso() });
  ok(res);
});

/* ── POST /api/conflicts/:id ────────────────────────────────────────────── */
// The only route by which a confirmed date can ever change.

app.post('/api/conflicts/:id', (req, res) => {
  const { id } = req.params;
  const c = db.prepare('SELECT * FROM conflicts WHERE id = ?').get(id);
  if (!c) return bad(res, 404, `No conflict ${id}.`);

  if (req.body?.accept) {
    db.prepare(`
      UPDATE components
      SET dueDate = ?, confidence = 'high', userConfirmed = 1, dateIsEstimate = 0,
          sourceFile = ?, sourceSnippet = ?, updatedAt = datetime('now')
      WHERE id = ?
    `).run(c.proposedDate, c.sourceFile, c.sourceSnippet, c.componentId);
    db.prepare("UPDATE conflicts SET status = 'resolved' WHERE id = ?").run(id);
    return ok(res);
  }

  // Keeping the existing date simply dismisses the conflict.
  db.prepare("UPDATE conflicts SET status = 'dismissed' WHERE id = ?").run(id);
  ok(res);
});

/* ── POST /api/term-weeks ───────────────────────────────────────────────── */

app.post('/api/term-weeks', (req, res) => {
  const weeks = Array.isArray(req.body?.weeks) ? req.body.weeks : null;
  if (!weeks) return bad(res, 400, 'weeks[] is required.');

  const clean = weeks
    .map((w) => ({
      weekNumber: Number(w.weekNumber),
      startDate: String(w.startDate || '').slice(0, 10),
      endDate: String(w.endDate || '').slice(0, 10),
      isReadingWeek: w.isReadingWeek ? 1 : 0,
    }))
    .filter((w) => /^\d{4}-\d{2}-\d{2}$/.test(w.startDate) && /^\d{4}-\d{2}-\d{2}$/.test(w.endDate));

  if (!clean.length) return bad(res, 400, 'No valid weeks supplied.');
  const badRange = clean.find((w) => w.endDate < w.startDate);
  if (badRange) return bad(res, 400, `Week ${badRange.weekNumber} ends before it starts.`);

  db.transaction(() => {
    db.prepare('DELETE FROM termWeeks').run();
    const ins = db.prepare(`
      INSERT INTO termWeeks (weekNumber, startDate, endDate, isReadingWeek)
      VALUES (@weekNumber, @startDate, @endDate, @isReadingWeek)
    `);
    for (const w of clean) ins.run(w);
    if (req.body.confirm != null) setSetting('termCalendarConfirmed', req.body.confirm ? 'true' : 'false');
  })();

  ok(res);
});

/* ── POST /api/errors  ·  POST /api/errors/:id ──────────────────────────── */

app.post('/api/errors', (req, res) => {
  const b = req.body || {};
  if (!b.courseId) return bad(res, 400, 'courseId is required.');
  const topic = String(b.topic || '').trim() || 'Untagged';
  const what = String(b.whatIGotWrong || '').trim().slice(0, 400);
  if (!what && topic === 'Untagged') return bad(res, 400, 'Write the reason.');

  db.prepare(`
    INSERT INTO errors (id, courseId, topic, whatIGotWrong, date)
    VALUES (?, ?, ?, ?, ?)
  `).run(rid('e'), b.courseId, topic, what, b.date || todayIso());
  ok(res);
});

app.post('/api/errors/:id', (req, res) => {
  if (!req.body?.delete) return bad(res, 400, 'Only deletion is supported.');
  db.prepare('DELETE FROM errors WHERE id = ?').run(req.params.id);
  ok(res);
});

/* ── POST /api/concepts  ·  POST /api/concepts/:id ──────────────────────── */

app.post('/api/concepts', (req, res) => {
  const b = req.body || {};
  if (!b.courseId) return bad(res, 400, 'courseId is required.');
  const id = rid('k');
  db.prepare(`
    INSERT INTO concepts (id, courseId, description, openedAt, status, rungs, fromStuckTimer)
    VALUES (?, ?, ?, ?, 'open', '[false,false,false]', ?)
  `).run(
    id,
    b.courseId,
    String(b.description || '').trim() || 'Unnamed block — write the sentence next time.',
    b.openedAt || nowIso(),
    b.fromStuckTimer ? 1 : 0
  );
  ok(res, { id });
});

app.post('/api/concepts/:id', (req, res) => {
  const { id } = req.params;
  const row = db.prepare('SELECT * FROM concepts WHERE id = ?').get(id);
  if (!row) return bad(res, 404, `No concept ${id}.`);
  const b = req.body || {};

  const patch = {};
  if (b.status && ['open', 'closed', 'escalated'].includes(b.status)) {
    patch.status = b.status;
    patch.resolvedAt = b.status === 'open' ? null : nowIso();
    if (b.status !== 'open') patch.fromStuckTimer = 0;
  }
  if (Array.isArray(b.rungs)) {
    patch.rungs = JSON.stringify(b.rungs.slice(0, 3).map(Boolean));
  }
  if ('fromStuckTimer' in b) patch.fromStuckTimer = b.fromStuckTimer ? 1 : 0;
  if (!Object.keys(patch).length) return bad(res, 400, 'Nothing to update.');

  const sets = Object.keys(patch).map((k) => `${k} = @${k}`).join(', ');
  db.prepare(`UPDATE concepts SET ${sets} WHERE id = @id`).run({ ...patch, id });
  ok(res);
});

/* ── POST /api/sessions ─────────────────────────────────────────────────── */
// Practice blocks and weekly reviews. Toggling is idempotent per slot.

app.post('/api/sessions', (req, res) => {
  const b = req.body || {};
  const type = ['practice', 'planned', 'review'].includes(b.type) ? b.type : null;
  if (!type) return bad(res, 400, 'type must be practice, planned or review.');
  const date = String(b.date || todayIso()).slice(0, 10);
  const courseId = type === 'review' ? null : b.courseId || null;
  if (type !== 'review' && !courseId) return bad(res, 400, 'courseId is required.');

  const existing = db.prepare(
    "SELECT id FROM sessions WHERE type = ? AND date = ? AND IFNULL(courseId,'') = ?"
  ).get(type, date, courseId || '');

  if (b.toggle && existing) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(existing.id);
    return ok(res);
  }
  if (existing) {
    db.prepare('UPDATE sessions SET note = ?, minutes = ? WHERE id = ?')
      .run(String(b.note || '').slice(0, 600), Number(b.minutes) || 0, existing.id);
    return ok(res);
  }

  db.prepare(`
    INSERT INTO sessions (id, courseId, date, minutes, type, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    rid('s'),
    courseId,
    date,
    Number(b.minutes) || (type === 'review' ? 20 : 90),
    type,
    String(b.note || '').slice(0, 600)
  );
  ok(res);
});

/* ── POST /api/plan ─────────────────────────────────────────────────────── */
// Tick a study slot off. The plan itself is derived and never stored — this
// records only that the block was worked, which no amount of recomputation
// should be able to take away.

app.post('/api/plan', (req, res) => {
  const b = req.body || {};
  const date = String(b.date || todayIso()).slice(0, 10);
  const slotKey = String(b.slotKey ?? '').slice(0, 16);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(res, 400, 'A yyyy-mm-dd date is required.');
  if (!slotKey) return bad(res, 400, 'slotKey is required.');

  const existing = db.prepare('SELECT 1 FROM planLog WHERE date = ? AND slotKey = ?').get(date, slotKey);
  if (existing) {
    db.prepare('DELETE FROM planLog WHERE date = ? AND slotKey = ?').run(date, slotKey);
    return ok(res);
  }
  db.prepare(`
    INSERT INTO planLog (date, slotKey, courseId, taskId, minutes, doneAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(date, slotKey, b.courseId || null, b.taskId || null, Math.max(0, Number(b.minutes) || 0), nowIso());
  ok(res);
});

/* ── POST /api/class-blocks ─────────────────────────────────────────────── */
// The whole timetable in one put. Replacing it wholesale keeps the client
// free to add, move and delete rows without a per-row protocol.

app.post('/api/class-blocks', (req, res) => {
  const blocks = Array.isArray(req.body?.blocks) ? req.body.blocks : null;
  if (!blocks) return bad(res, 400, 'blocks[] is required.');

  const known = new Set(db.prepare('SELECT id FROM courses').all().map((c) => c.id));
  const clean = [];
  for (const raw of blocks) {
    const courseId = String(raw.courseId || '');
    const weekday = Number(raw.weekday);
    const startMin = Math.round(Number(raw.startMin));
    const endMin = Math.round(Number(raw.endMin));
    if (!known.has(courseId)) return bad(res, 400, `Unknown course ${courseId}.`);
    if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
      return bad(res, 400, 'weekday must be 0–6.');
    }
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) {
      return bad(res, 400, 'Class times must be numbers.');
    }
    if (startMin < 0 || endMin > 24 * 60) return bad(res, 400, 'Class times must be inside one day.');
    if (endMin <= startMin) return bad(res, 400, 'A class cannot end before it starts.');
    clean.push({
      id: String(raw.id || `${courseId}-${weekday}-${startMin}`).slice(0, 64),
      courseId,
      weekday,
      startMin,
      endMin,
      kind: ['LEC', 'LAB', 'TUT', 'PRJ'].includes(raw.kind) ? raw.kind : 'LEC',
      label: String(raw.label || '').slice(0, 60),
    });
  }

  // Two ids colliding would silently drop a class from the timetable, which
  // would silently hand the planner an hour that does not exist.
  const ids = new Set();
  for (const b of clean) {
    while (ids.has(b.id)) b.id = `${b.id}x`;
    ids.add(b.id);
  }

  db.transaction(() => {
    db.prepare('DELETE FROM classBlocks').run();
    const ins = db.prepare(`
      INSERT INTO classBlocks (id, courseId, weekday, startMin, endMin, kind, label)
      VALUES (@id, @courseId, @weekday, @startMin, @endMin, @kind, @label)
    `);
    for (const b of clean) ins.run(b);
  })();

  ok(res);
});

/* ── POST /api/settings ─────────────────────────────────────────────────── */

const ALLOWED_SETTINGS = new Set([
  'slipDays', 'stuckMinutes', 'minErrorsAtT14', 'examHorizonDays',
  'minutesPerErrorReview', 'termStart', 'termEnd', 'termCalendarConfirmed',
  // the planner
  'dayStartMin', 'dayEndMin', 'dailyTargetHours', 'weekendTargetHours',
  'minBlockMinutes', 'maxBlockMinutes', 'breakMinutes', 'classBufferMinutes',
  'planHorizonDays', 'urgentSlackDays', 'focusHoursPerDay',
]);

app.post('/api/settings', (req, res) => {
  const entries = Object.entries(req.body || {}).filter(([k]) => ALLOWED_SETTINGS.has(k));
  if (!entries.length) return bad(res, 400, 'No known settings in body.');
  db.transaction(() => {
    for (const [k, v] of entries) setSetting(k, v);
  })();
  ok(res);
});

/* ── POST /api/reset ────────────────────────────────────────────────────── */

app.post('/api/reset', (_req, res) => {
  seedIfEmpty({ force: true });
  ok(res);
});

app.use('/api', (_req, res) => bad(res, 404, 'No such endpoint.'));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`  deck server   http://127.0.0.1:${PORT}`);
  console.log(`  database      ${DB_PATH}`);
  console.log(`  scan root     ${SCAN_ROOT}`);
});
