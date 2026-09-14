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

function safeRungs(raw) {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) && v.length === 3 ? v.map(Boolean) : [false, false, false];
  } catch {
    return [false, false, false];
  }
}
