import { db, getSettings, SCAN_ROOT, APP_ROOT, DB_PATH } from './db.js';

/**
 * The whole deck, in one payload. All derivation (priority scoring, streaks,
 * taper) happens on the client exactly as it did in the mockup — the server's
 * job is to own the filesystem and the durable rows, not the ranking.
 */
export function buildState() {
  const courses = db.prepare(`
    SELECT id, code, title, instructor, folderPath, meets, contact, contactShort,
           examCourse, weightsKnown, sortOrder
    FROM courses ORDER BY sortOrder, code
  `).all();

  const components = db.prepare(`
    SELECT id, courseId, title, weight, dueDate, confidence, sourceFile,
           sourceSnippet, userConfirmed, status, estHours, kind, droppable,
           trap, free, note, dateIsEstimate
    FROM components ORDER BY courseId, IFNULL(dueDate, '9999'), title
  `).all();

  const errors = db.prepare(
    'SELECT id, courseId, topic, whatIGotWrong, date FROM errors ORDER BY date DESC, rowid DESC'
  ).all();

  const concepts = db.prepare(`
    SELECT id, courseId, description, openedAt, resolvedAt, status, rungs, fromStuckTimer
    FROM concepts ORDER BY openedAt DESC
  `).all().map((c) => ({ ...c, rungs: safeRungs(c.rungs) }));

  const sessions = db.prepare(
    'SELECT id, courseId, date, minutes, type, note FROM sessions ORDER BY date'
  ).all();

  const termWeeks = db.prepare(`
    SELECT weekNumber, startDate, endDate, isReadingWeek
    FROM termWeeks ORDER BY startDate
  `).all();

  const conflicts = db.prepare(`
    SELECT c.id, c.componentId, c.proposedDate, c.currentDate, c.confidence,
           c.sourceFile, c.sourceSnippet, c.detectedAt, c.status,
           m.title AS componentTitle, m.courseId
    FROM conflicts c JOIN components m ON m.id = c.componentId
    WHERE c.status = 'open' ORDER BY c.detectedAt DESC
  `).all();

  const classBlocks = db.prepare(`
    SELECT id, courseId, weekday, startMin, endMin, kind, label
    FROM classBlocks ORDER BY weekday, startMin
  `).all();

  // The last fortnight of ticked study slots is all the Today view needs to
  // draw its streak and its "hours done" meter.
  const planLog = db.prepare(`
    SELECT date, slotKey, courseId, taskId, minutes, doneAt
    FROM planLog WHERE date >= date('now', '-21 days') ORDER BY date, slotKey
  `).all();

  // What to actually open. The scanner already knows every file it parsed, so
  // the planner can name a real document rather than saying "study ME 524".
  const materials = db.prepare(`
    SELECT path, courseId, mtime, size
    FROM files
    WHERE courseId IS NOT NULL AND parseStatus = 'ok'
    ORDER BY courseId, IFNULL(mtime, '') DESC
  `).all().map((f) => ({
    courseId: f.courseId,
    path: f.path,
    name: String(f.path).split(/[\\/]/).pop(),
    mtime: f.mtime,
    kind: materialKind(f.path),
  }));

  const fileStats = db.prepare(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN parseStatus = 'error' THEN 1 ELSE 0 END) AS failed
    FROM files
  `).get();

  return {
    courses: courses.map((c) => ({
      ...c,
      examCourse: !!c.examCourse,
      weightsKnown: !!c.weightsKnown,
    })),
    components: components.map((m) => ({
      ...m,
      userConfirmed: !!m.userConfirmed,
      droppable: !!m.droppable,
      trap: !!m.trap,
      free: !!m.free,
      dateIsEstimate: !!m.dateIsEstimate,
    })),
    errors,
    concepts,
    sessions,
    termWeeks,
    conflicts,
    classBlocks,
    planLog,
    materials,
    settings: getSettings(),
    meta: {
      scanRoot: SCAN_ROOT,
      appRoot: APP_ROOT,
      dbPath: DB_PATH,
      filesTracked: fileStats.total || 0,
      filesFailed: fileStats.failed || 0,
      serverNow: new Date().toISOString(),
    },
  };
}

/**
 * A rough type for a course file, taken from its name. Used by the planner to
 * pick the right thing to open: practice before an exam wants problems and
 * solutions, an early project session wants the brief.
 */
function materialKind(p) {
  const n = String(p).split(/[\\/]/).pop().toLowerCase();
  if (/\b(outline|syllabus|schedule)\b/.test(n)) return 'outline';
  if (/(solution|soln|answers|_sol\b)/.test(n)) return 'solutions';
  if (/(assign|homework|\bhw\b|problem\s*set|\ba\d|_a\d)/.test(n)) return 'assignment';
  if (/(project|proposal|report|template)/.test(n)) return 'project';
  if (/\b(lab|tutorial)/.test(n)) return 'lab';
  if (/(exam|midterm|test|quiz|past\s*paper)/.test(n)) return 'exam';
  if (/(question|example|practice|problem)/.test(n)) return 'practice';
  if (/(lecture|slide|notes|chapter|\bch\s*\d|week\s*\d|part\s*\d)/.test(n)) return 'lecture';
  return 'material';
}

function safeRungs(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) && v.length === 3 ? v.map(Boolean) : [false, false, false];
  } catch {
    return [false, false, false];
  }
}
