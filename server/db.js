import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSES, COMPONENTS, TERM_WEEKS, SETTINGS } from './seed.js';

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
  const insSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  db.transaction(() => {
    for (const c of COURSES) insCourse.run(c);
    for (const c of COMPONENTS) insComponent.run(c);
    for (const w of TERM_WEEKS) insWeek.run(w);
    for (const [k, v] of Object.entries(SETTINGS)) insSetting.run(k, String(v));
  })();

  return true;
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
