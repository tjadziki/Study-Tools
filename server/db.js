import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSES, COMPONENTS, TERM_WEEKS, SETTINGS, CLASS_BLOCKS } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Workspace root — the folder holding this app. deck.db lives here. */
export const APP_ROOT = path.resolve(here, '..');

/**
 * Where course folders are looked for. Defaults to the parent of the app
 * folder, which is where the per-course directories actually live. Override
 * with DECK_SCAN_ROOT when the layout differs.
 */
export const SCAN_ROOT = path.resolve(process.env.DECK_SCAN_ROOT || path.resolve(APP_ROOT, '..'));

const DB_PATH = process.env.DECK_DB || path.join(APP_ROOT, 'deck.db');

export const db = new Database(DB_PATH);
db.exec(fs.readFileSync(path.join(here, 'schema.sql'), 'utf8'));

/** True when the deck has never been seeded. */
function isEmpty() {
  return db.prepare('SELECT COUNT(*) AS n FROM courses').get().n === 0;
}

export function seedIfEmpty({ force = false } = {}) {
  if (force) {
    db.exec(`
      DELETE FROM conflicts; DELETE FROM components; DELETE FROM errors;
      DELETE FROM concepts; DELETE FROM sessions; DELETE FROM termWeeks;
      DELETE FROM planLog; DELETE FROM classBlocks;
      DELETE FROM settings; DELETE FROM courses;
    `);
    // File rows are kept — the hashes are still valid, so nothing needs
    // re-hashing. But candidates are derived from parsed text that is not
    // stored, so every file is marked pending: the next scan re-parses and
    // rebuilds the review queue instead of reporting "0 changed" over an
    // empty deck.
    db.prepare("UPDATE files SET parseStatus = 'pending', lastParsed = NULL WHERE parseStatus = 'ok'").run();
  } else if (!isEmpty()) {
    return false;
  }

  const insCourse = db.prepare(`
    INSERT INTO courses (id, code, title, instructor, folderPath, meets, contact,
                         contactShort, examCourse, weightsKnown, sortOrder)
    VALUES (@id, @code, @title, @instructor, NULL, @meets, @contact,
            @contactShort, @examCourse, @weightsKnown, @sortOrder)
  `);
  const insComponent = db.prepare(`
    INSERT INTO components (id, courseId, title, weight, dueDate, confidence,
                            sourceFile, sourceSnippet, userConfirmed, status,
                            estHours, kind, droppable, trap, free, note, dateIsEstimate)
    VALUES (@id, @courseId, @title, @weight, @dueDate, @confidence,
            @sourceFile, @sourceSnippet, @userConfirmed, @status,
            @estHours, @kind, @droppable, @trap, @free, @note, @dateIsEstimate)
  `);
  const insWeek = db.prepare(`
    INSERT INTO termWeeks (weekNumber, startDate, endDate, isReadingWeek)
    VALUES (@weekNumber, @startDate, @endDate, @isReadingWeek)
  `);
  const insBlock = db.prepare(`
    INSERT INTO classBlocks (id, courseId, weekday, startMin, endMin, kind, label)
    VALUES (@id, @courseId, @weekday, @startMin, @endMin, @kind, @label)
  `);
  const insSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  db.transaction(() => {
    for (const c of COURSES) insCourse.run(c);
    for (const c of COMPONENTS) insComponent.run(c);
    for (const w of TERM_WEEKS) insWeek.run(w);
    for (const b of CLASS_BLOCKS) insBlock.run(b);
    for (const [k, v] of Object.entries(SETTINGS)) insSetting.run(k, String(v));
  })();

  return true;
}

/**
 * Bring an already-seeded database up to date with new seed material.
 *
 * Called on every boot. It only ever fills in what is missing — a timetable
 * that was never seeded, a setting added after this deck was created. It
 * never touches components, so a confirmed due date cannot be undone by an
 * upgrade.
 */
export function backfill() {
  const added = [];

  const blocks = db.prepare('SELECT COUNT(*) AS n FROM classBlocks').get().n;
  if (blocks === 0 && !isEmpty()) {
    const ins = db.prepare(`
      INSERT INTO classBlocks (id, courseId, weekday, startMin, endMin, kind, label)
      VALUES (@id, @courseId, @weekday, @startMin, @endMin, @kind, @label)
    `);
    const known = new Set(db.prepare('SELECT id FROM courses').all().map((c) => c.id));
    db.transaction(() => {
      for (const b of CLASS_BLOCKS) if (known.has(b.courseId)) ins.run(b);
    })();
    added.push(`${CLASS_BLOCKS.length} class blocks`);
  }

  const have = new Set(db.prepare('SELECT key FROM settings').all().map((r) => r.key));
  const missing = Object.entries(SETTINGS).filter(([k]) => !have.has(k));
  if (missing.length && have.size) {
    db.transaction(() => {
      for (const [k, v] of missing) setSetting(k, String(v));
    })();
    added.push(`${missing.length} settings`);
  }

  return added;
}

/* ── settings helpers ───────────────────────────────────────────────────── */

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value));
}

export { DB_PATH };
