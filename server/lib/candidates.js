import crypto from 'node:crypto';
import { extractDates } from './dateExtract.js';
import { matchComponent } from './match.js';

const shortHash = (s) => crypto.createHash('sha256').update(s).digest('hex').slice(0, 10);
const RANK = { high: 3, medium: 2, low: 1 };

/**
 * Turn one parsed document into date proposals.
 *
 * Nothing here ever overwrites a date the user has confirmed. A confirmed
 * component that disagrees with the document raises a conflict row instead,
 * which is the only way a confirmed date can ever change.
 */
export function applyCandidates(db, { file, text, ctx }) {
  const { termStart, termEnd, termWeeks, calendarConfirmed } = ctx;

  const found = extractDates(text, {
    termStart, termEnd, termWeeks, calendarConfirmed,
  });

  const result = { proposed: 0, conflicts: 0, outOfTerm: 0, newItems: 0, readingWeek: null };
  if (!found.length) {
    clearStale(db, file.path);
    return result;
  }

  // A reading-week span is calendar evidence, not a deadline. Milestone 5's
  // term-calendar screen offers it as a correction to the seeded guess.
  const rw = found.find((c) => c.kind === 'readingWeek' && c.rangeEnd);
  if (rw) result.readingWeek = { startDate: rw.date, endDate: rw.rangeEnd, sourceFile: file.path };

  result.outOfTerm = found.filter((c) => c.kind === 'outOfTerm').length;

  // Only deadline-shaped candidates become proposals. Ranges, lecture rows,
  // reading week and out-of-term dates are counted, never proposed.
  const proposals = found.filter(
    (c) => c.date && (c.kind === 'deadline' || c.kind === 'weekRelative')
  );

  clearStale(db, file.path);
  if (!proposals.length) return result;

  const collapsed = collapseToCutoff(proposals);

  const components = db
    .prepare(
      `SELECT id, title, weight, dueDate, confidence, userConfirmed, sourceFile, status
       FROM components WHERE courseId = ? AND status IN ('todo','done')`
    )
    .all(file.courseId);

  for (const c of collapsed) {
    const { component } = matchComponent(c, components);

    if (component) {
      if (component.userConfirmed) {
        if (component.dueDate !== c.date) {
          raiseConflict(db, component, c, file);
          result.conflicts++;
        }
        continue;
      }

      // Unconfirmed: keep whichever proposal we trust most.
      const better =
        !component.dueDate ||
        RANK[c.confidence] > RANK[component.confidence || 'low'];
      if (!better) continue;

      db.prepare(
        `UPDATE components
         SET dueDate = @date, confidence = @confidence, sourceFile = @sourceFile,
             sourceSnippet = @snippet, dateIsEstimate = 1, userConfirmed = 0,
             updatedAt = datetime('now')
         WHERE id = @id`
      ).run({
        id: component.id,
        date: c.date,
        confidence: c.confidence,
        sourceFile: file.path,
        snippet: `${c.snippet}\n— ${c.reason}`,
      });
      component.dueDate = c.date;
      component.confidence = c.confidence;
      result.proposed++;
      continue;
    }

    // No component fits. Propose a new one, but only when the evidence is
    // decent — low-confidence unmatched dates would bury the review queue.
    if (c.confidence === 'low') continue;

    const id = `cand_${file.courseId}_${c.date}_${shortHash(c.snippet)}`;
    const exists = db.prepare('SELECT id, status FROM components WHERE id = ?').get(id);
    if (exists) continue;

    db.prepare(
      `INSERT INTO components
         (id, courseId, title, weight, dueDate, confidence, sourceFile,
          sourceSnippet, userConfirmed, status, estHours, kind, dateIsEstimate)
       VALUES (@id, @courseId, @title, 0, @date, @confidence, @sourceFile,
               @snippet, 0, 'candidate', 2, @kind, 1)`
    ).run({
      id,
      courseId: file.courseId,
      title: guessTitle(c.snippet) || `Untitled deliverable — ${c.date}`,
      date: c.date,
      confidence: c.confidence,
      sourceFile: file.path,
      snippet: `${c.snippet}\n— ${c.reason}`,
      kind: /\b(exam|midterm|final|test)\b/i.test(c.snippet) ? 'exam' : 'work',
    });
    result.newItems++;
  }

  return result;
}

/**
 * One deliverable, one deadline.
 *
 * A LEARN schedule row commonly names two dates for a single item:
 *   "Original Posts: Wednesday Sep 16 ... Reply Post: Friday Sep 18"
 *   "Opens Thursday Oct 8 ... Closes Friday Oct 9"
 * In both cases the deliverable is finished on the later date, so candidates
 * sharing a snippet collapse to the latest. The 14-day guard stops this from
 * merging two genuinely different deadlines that happen to share a sentence.
 */
export function collapseToCutoff(proposals, maxSpanDays = 14) {
  const groups = new Map();
  for (const c of proposals) {
    const list = groups.get(c.snippet) || [];
    list.push(c);
    groups.set(c.snippet, list);
  }

  const out = [];
  for (const list of groups.values()) {
    if (list.length === 1) {
      out.push(list[0]);
      continue;
    }
    const sorted = list.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    const spanDays =
      (Date.parse(`${sorted.at(-1).date}T12:00:00`) - Date.parse(`${sorted[0].date}T12:00:00`)) / 86400000;

    if (spanDays > maxSpanDays) {
      out.push(...sorted); // too far apart to be one deliverable
    } else {
      const latest = sorted.at(-1);
      out.push({
        ...latest,
        reason: `${latest.reason} Taken as the cutoff of ${sorted.length} dates in this row (${sorted
          .map((x) => x.date)
          .join(' → ')}).`,
      });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/**
 * Drop this file's previous unconfirmed output before re-applying, so a
 * re-parse replaces its proposals instead of accumulating duplicates.
 * Confirmed rows are never touched.
 */
function clearStale(db, sourceFile) {
  db.prepare(
    `DELETE FROM components
     WHERE status = 'candidate' AND userConfirmed = 0 AND sourceFile = ?`
  ).run(sourceFile);

  db.prepare(
    `UPDATE components
     SET dueDate = NULL, confidence = 'low', sourceFile = NULL, sourceSnippet = NULL
     WHERE userConfirmed = 0 AND sourceFile = ? AND status IN ('todo','done')`
  ).run(sourceFile);
}

function raiseConflict(db, component, candidate, file) {
  const id = `cf_${component.id}_${candidate.date}`;
  const existing = db.prepare('SELECT id, status FROM conflicts WHERE id = ?').get(id);
  if (existing) {
    // Re-open a conflict the user dismissed only if it is still unresolved.
    if (existing.status === 'open') return;
    return;
  }
  db.prepare(
    `INSERT INTO conflicts
       (id, componentId, proposedDate, currentDate, confidence, sourceFile, sourceSnippet, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`
  ).run(
    id,
    component.id,
    candidate.date,
    component.dueDate,
    candidate.confidence,
    file.path,
    `${candidate.snippet}\n— ${candidate.reason}`
  );
}

/** Best-effort deliverable name from a schedule row or sentence. */
function guessTitle(snippet) {
  // Schedule rows are tab-separated; the deliverable is usually the cell right
  // before the one holding the date.
  const cells = snippet.split('\t').map((s) => s.trim()).filter(Boolean);
  if (cells.length > 1) {
    const dateCell = cells.findIndex((c) => /\d{4}|\d{1,2}:\d{2}/.test(c));
    const pick = dateCell > 0 ? cells[dateCell - 1] : cells[cells.length - 1];
    if (pick && pick.length > 3 && pick.length < 80 && !/^week\s*\d+$/i.test(pick)) {
      return pick.replace(/\s+/g, ' ').slice(0, 80);
    }
  }
  const m = snippet.match(
    /\b((?:assignment|project|quiz|test|exam|midterm|final|report|proposal|presentation|lab|milestone|discussion)[^.;\t]{0,48})/i
  );
  return m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 80) : null;
}
