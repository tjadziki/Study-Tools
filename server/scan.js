import fsp from 'node:fs/promises';
import path from 'node:path';
import { db, setSetting, SCAN_ROOT, APP_ROOT } from './db.js';
import { findCourseFolders, walkFiles, hashFile, normaliseCode } from './lib/walker.js';
import { extractText } from './lib/extract.js';
import { applyCandidates } from './lib/candidates.js';

const DUMP_DIR = path.join(APP_ROOT, 'scan-dump');

/**
 * Walk every course folder, hash every file, and parse only what actually
 * changed. Yields progress events so the UI can show a live counter, then a
 * final summary event.
 *
 * Strictly read-only over course material: it opens files and never writes,
 * moves or renames one. The only writes are to deck.db and, when dump is on,
 * to StudyHub/scan-dump/.
 */
export async function* runScan({ parse = true, dump = true, force = false } = {}) {
  const startedAt = Date.now();

  /* ── 1. discover course folders ───────────────────────────────────────── */
  yield { type: 'phase', phase: 'discover', message: `Looking for course folders in ${SCAN_ROOT}` };

  const { folders, unmatched, error } = await findCourseFolders(SCAN_ROOT);
  if (error) {
    yield { type: 'done', summary: { ok: false, error: `Cannot read ${SCAN_ROOT}: ${error}` } };
    return;
  }

  const courses = db.prepare('SELECT id, code FROM courses').all();
  const courseByCode = new Map(courses.map((c) => [normaliseCode(c.code), c]));

  const matched = [];
  const unmatchedFolders = [...unmatched];
  for (const f of folders) {
    const course = courseByCode.get(f.code);
    if (course) {
      matched.push({ ...f, courseId: course.id, courseCode: course.code });
      db.prepare('UPDATE courses SET folderPath = ? WHERE id = ?').run(f.absPath, course.id);
    } else {
      // A folder that looks like a course but matches no seeded course.
      unmatchedFolders.push(`${f.dirName} (no course with code ${f.code})`);
    }
  }

  yield {
    type: 'phase',
    phase: 'walk',
    message: `${matched.length} course folder${matched.length === 1 ? '' : 's'} matched`,
  };

  /* ── 2. walk ──────────────────────────────────────────────────────────── */
  const found = [];
  for (const m of matched) {
    const files = await walkFiles(m.absPath);
    for (const f of files) found.push({ ...f, courseId: m.courseId, courseCode: m.courseCode });
  }

  const total = found.length;
  yield { type: 'phase', phase: 'hash', message: `${total} files found`, total };

  /* ── 3. hash + diff ───────────────────────────────────────────────────── */
  const known = new Map(
    db.prepare('SELECT path, hash, parseStatus, lastParsed FROM files').all().map((r) => [r.path, r])
  );

  const stats = {
    filesSeen: total,
    new: 0,
    changed: 0,
    unchanged: 0,
    skipped: 0,
    removed: 0,
    parsed: 0,
    failed: 0,
    candidateDates: 0,
    conflicts: 0,
    outOfTerm: 0,
  };

  // Context the date extractor needs. The calendar is a best guess until the
  // user confirms it, and that flag caps how far a week-relative date is trusted.
  const settingsRows = db.prepare('SELECT key, value FROM settings').all();
  const S = Object.fromEntries(settingsRows.map((r) => [r.key, r.value]));
  const ctx = {
    termStart: S.termStart || '2026-09-09',
    termEnd: S.termEnd || '2026-12-08',
    termWeeks: db.prepare('SELECT * FROM termWeeks ORDER BY startDate').all(),
    calendarConfirmed: S.termCalendarConfirmed === 'true',
  };
  const readingWeekEvidence = [];

  const upsert = db.prepare(`
    INSERT INTO files (path, hash, courseId, size, mtime, parseStatus, parseError, lastParsed)
    VALUES (@path, @hash, @courseId, @size, @mtime, @parseStatus, @parseError, @lastParsed)
    ON CONFLICT(path) DO UPDATE SET
      hash = excluded.hash, courseId = excluded.courseId, size = excluded.size,
      mtime = excluded.mtime, parseStatus = excluded.parseStatus,
      parseError = excluded.parseError, lastParsed = excluded.lastParsed
  `);

  // Unchanged files only need their stat fields refreshed — never their parse
  // state, which stays valid precisely because the bytes did not move.
  const touch = db.prepare(`
    UPDATE files SET size = @size, mtime = @mtime, courseId = @courseId WHERE path = @path
  `);

  const toParse = [];
  let done = 0;

  for (const f of found) {
    done++;
    const prev = known.get(f.path);

    if (f.skipReason) {
      stats.skipped++;
      upsert.run({
        path: f.path, hash: prev?.hash ?? '', courseId: f.courseId, size: f.size,
        mtime: f.mtime, parseStatus: 'skipped', parseError: f.skipReason,
        lastParsed: prev?.lastParsed ?? null,
      });
      known.delete(f.path);
      yield { type: 'progress', done, total, file: f.name, course: f.courseCode, action: 'skipped' };
      continue;
    }

    let hash;
    try {
      hash = await hashFile(f.path);
    } catch (e) {
      stats.failed++;
      upsert.run({
        path: f.path, hash: '', courseId: f.courseId, size: f.size, mtime: f.mtime,
        parseStatus: 'error', parseError: `unreadable: ${e.message}`, lastParsed: null,
      });
      known.delete(f.path);
      yield { type: 'progress', done, total, file: f.name, course: f.courseCode, action: 'error' };
      continue;
    }

    let action;
    if (!prev) {
      stats.new++;
      action = 'new';
    } else if (prev.hash !== hash) {
      stats.changed++;
      action = 'changed';
    } else if (force || prev.parseStatus !== 'ok') {
      // Same bytes, but not yet successfully parsed — a previous run may have
      // errored, or recorded the hash without parsing. Worth another attempt.
      stats.unchanged++;
      action = force ? 'forced' : 'retry';
    } else {
      stats.unchanged++;
      action = 'unchanged';
    }

    known.delete(f.path);

    if (action === 'unchanged') {
      // Nothing to re-parse. This is the whole point of the hash ledger, so
      // lastParsed and parseStatus are left exactly as they were.
      touch.run({ path: f.path, size: f.size, mtime: f.mtime, courseId: f.courseId });
    } else {
      // Record the hash now, as pending. If parsing is off or this process
      // dies mid-scan, the ledger still knows the file and its bytes, and the
      // "not yet ok" rule above brings it back for parsing next time.
      upsert.run({
        path: f.path, hash, courseId: f.courseId, size: f.size, mtime: f.mtime,
        parseStatus: 'pending', parseError: null, lastParsed: null,
      });
      toParse.push({ ...f, hash, action });
    }

    yield { type: 'progress', done, total, file: f.name, course: f.courseCode, action };
  }

  /* ── 4. files that vanished from disk ─────────────────────────────────── */
  // Anything still in `known` was in the ledger but is no longer on disk.
  for (const [p] of known) {
    db.prepare('DELETE FROM files WHERE path = ?').run(p);
    stats.removed++;
  }

  /* ── 5. parse only what changed ───────────────────────────────────────── */
  const failures = [];
  const extracted = [];

  if (parse && toParse.length) {
    yield { type: 'phase', phase: 'parse', message: `Parsing ${toParse.length} file(s)`, total: toParse.length };

    if (dump) await fsp.mkdir(DUMP_DIR, { recursive: true }).catch(() => {});

    let p = 0;
    for (const f of toParse) {
      p++;
      try {
        const { text, pages, warning } = await extractText(f.path);
        stats.parsed++;
        extracted.push({ ...f, text, pages });

        upsert.run({
          path: f.path, hash: f.hash, courseId: f.courseId, size: f.size, mtime: f.mtime,
          parseStatus: 'ok', parseError: warning, lastParsed: new Date().toISOString(),
        });

        if (dump) await writeDump(f, text, pages);

        // Extract date candidates from this document.
        const found = applyCandidates(db, { file: f, text, ctx });
        stats.candidateDates += found.proposed + found.newItems;
        stats.conflicts += found.conflicts;
        stats.outOfTerm += found.outOfTerm;
        if (found.readingWeek) readingWeekEvidence.push(found.readingWeek);

        yield {
          type: 'progress', done: p, total: toParse.length, phase: 'parse',
          file: f.name, course: f.courseCode, action: 'parsed',
          chars: text.length, dates: found.proposed + found.newItems,
        };
      } catch (e) {
        // One bad file must not abort the scan.
        stats.failed++;
        failures.push({ file: f.name, course: f.courseCode, error: e.message });
        upsert.run({
          path: f.path, hash: f.hash, courseId: f.courseId, size: f.size, mtime: f.mtime,
          parseStatus: 'error', parseError: e.message, lastParsed: null,
        });
        yield {
          type: 'progress', done: p, total: toParse.length, phase: 'parse',
          file: f.name, course: f.courseCode, action: 'failed', error: e.message,
        };
      }
    }
  }

  /* ── 6. summary ───────────────────────────────────────────────────────── */
  const lastScannedAt = new Date().toISOString();
  setSetting('lastScannedAt', lastScannedAt);

  // Reading-week evidence found in the documents is offered to the term
  // calendar as a proposed correction — it is never applied automatically.
  if (readingWeekEvidence.length) {
    setSetting('readingWeekEvidence', JSON.stringify(readingWeekEvidence[0]));
  }

  yield {
    type: 'done',
    summary: {
      ok: true,
      ...stats,
      durationMs: Date.now() - startedAt,
      lastScannedAt,
      coursesMatched: matched.map((m) => ({ code: m.courseCode, folder: m.dirName })),
      unmatchedFolders,
      failures,
      dumpDir: dump && extracted.length ? DUMP_DIR : null,
      message: summaryLine(stats),
    },
    extracted,
  };
}

function summaryLine(s) {
  const bits = [`Scanned ${s.filesSeen} file${s.filesSeen === 1 ? '' : 's'}`];
  bits.push(`${s.new} new`);
  bits.push(`${s.changed} changed`);
  if (s.removed) bits.push(`${s.removed} gone`);
  if (s.skipped) bits.push(`${s.skipped} skipped`);
  let line = `${bits.join(', ')}.`;
  if (s.parsed) line += ` Parsed ${s.parsed}.`;
  if (s.failed) line += ` ${s.failed} failed.`;
  line += ` Found ${s.candidateDates} new candidate date${s.candidateDates === 1 ? '' : 's'}.`;
  if (s.conflicts) line += ` ${s.conflicts} conflict${s.conflicts === 1 ? '' : 's'} with confirmed dates.`;
  if (s.outOfTerm) line += ` ${s.outOfTerm} date${s.outOfTerm === 1 ? '' : 's'} outside the term were ignored.`;
  return line;
}

/** Raw-text dump, so parsing can be eyeballed before any rule trusts it. */
async function writeDump(f, text, pages) {
  const dir = path.join(DUMP_DIR, f.courseCode.replace(/\s+/g, ''));
  await fsp.mkdir(dir, { recursive: true });
  const safe = f.name.replace(/[^\w.\- ]+/g, '_');
  const header =
    `# ${f.name}\n# ${f.path}\n# ${f.size} bytes` +
    `${pages ? ` · ${pages} page(s)` : ''} · ${text.length} chars extracted\n` +
    `${'─'.repeat(70)}\n\n`;
  await fsp.writeFile(path.join(dir, `${safe}.txt`), header + text, 'utf8');
}
