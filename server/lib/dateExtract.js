// Date extraction.
//
// Every result is a CANDIDATE, never a fact. Each carries a confidence, the
// snippet it came from, and a plain-English reason for that confidence, so the
// review queue can put the evidence next to the proposal.
//
// The patterns here were written against the actual Fall 2026 course files in
// this workspace, not invented:
//
//   "Date/Time DUE: Wednesday October 22 , 2025 by 11:59pm"  (ME 559 — note
//        the stray space before the comma, from a detached ordinal
//        superscript, and note the YEAR: those PDFs are last year's)
//   "Friday, September 25, 2026 at 11:59 PM"                 (HLTH 101)
//   "Opens Thursday, October 8 ... Closes Friday, October 9" (HLTH 101 tests)
//   "Reading Week (Saturday, October 10, 2026 to Sunday, October 18, 2026)"
//   "09/10 \t - \t Introduction to Advanced Dynamics"        (ME 524 lecture
//        rows — forty of them, and NOT deadlines)

export const MONTHS = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10,
  nov: 11, november: 11, dec: 12, december: 12,
};

export const WEEKDAYS = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

const MONTH_ALT = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|');
const DAY_ALT = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|');

/* "Wednesday October 22 , 2025" · "Friday, September 25, 2026" · "Oct 9" */
const LONG_DATE = new RegExp(
  String.raw`\b(?:(${DAY_ALT})\.?,?\s+)?` +
  String.raw`(${MONTH_ALT})\.?\s+` +
  String.raw`(\d{1,2})\s*(?:st|nd|rd|th)?\s*` +
  String.raw`(?:,\s*(\d{4}))?`,
  'gi'
);

/* "30 November 2026" — day first */
const LONG_DATE_DMY = new RegExp(
  String.raw`\b(\d{1,2})\s*(?:st|nd|rd|th)?\s+(${MONTH_ALT})\.?\s*(?:,?\s*(\d{4}))?\b`,
  'gi'
);

/* "11/30/2026" · "30-11-2026" · "11/30/26" */
const NUMERIC_DATE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/g;

/* "09/10" with no year — the ME 524 lecture-schedule shape */
const BARE_MMDD = /(?:^|[\s\t])(\d{1,2})\/(\d{1,2})(?=[\s\t]|$)/g;

/* "Friday of Week 5" · "Week 5 Friday" · "end of week 3" */
const WEEK_REL = new RegExp(
  String.raw`\b(?:(${DAY_ALT})\s+of\s+week\s*(\d{1,2})` +
  String.raw`|week\s*(\d{1,2})\s*[,:]?\s+(${DAY_ALT})` +
  String.raw`|(?:end|close|last\s+day)\s+of\s+week\s*(\d{1,2}))\b`,
  'gi'
);

/* Context signals. */
const STRONG_DUE = /\b(?:due|deadline|due\s*date|closes?|submit(?:ted|ssion)?\s+by|hand\s*-?\s*in\s+by|must\s+be\s+(?:submitted|received)|no\s+later\s+than)\b/i;
const WEAK_DUE = /\b(?:assignment|project|report|quiz|test|exam|midterm|final|discussion|proposal|presentation|milestone|deliverable)\b/i;
const NOT_DUE = /\b(?:assigned|posted|released|available|opens?|lecture|reading|chapter|holiday|week\s+of|revised|updated|copyright|version)\b/i;
const RANGE_JOIN = /\b(?:to|through|until|–|—|-)\b/;
const READING_WEEK = /\breading\s+week\b/i;

/**
 * A clock time immediately after a date ("at 11:59 PM", "by 5pm") is itself a
 * deadline signal — nobody writes a minute-precise time for a lecture. This
 * carries LEARN's "Original Posts: Wednesday, September 16, 2026 at 11:59 PM"
 * rows, which name no due-word at all.
 */
const TIME_AFTER = /^[\s,]*(?:at|by|before|@)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)/i;
const CUTOFF_TIME = /\b(?:11:59|23:59)\s*(?:pm)?\b/i;

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

/** Real calendar date? Rejects Feb 30 and friends. */
export function isValidYmd(y, m, d) {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d, 12);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Pick the year for a date written without one: whichever candidate year lands
 * the date inside the term. Falls back to the term's start year.
 */
export function inferYear(month, day, termStart, termEnd) {
  const ys = Number(termStart.slice(0, 4));
  const ye = Number(termEnd.slice(0, 4));
  for (const y of new Set([ys, ye])) {
    const iso = isoOf(y, month, day);
    if (isValidYmd(y, month, day) && iso >= termStart && iso <= termEnd) {
      return { year: y, inTerm: true };
    }
  }
  return { year: ys, inTerm: false };
}

/**
 * Resolve "Friday of Week 5" against the term calendar.
 * Reading weeks are stored with weekNumber 0, so they never consume a lecture
 * week number — week 6 is the week after reading week, as the outlines mean it.
 */
export function resolveWeekRelative(weekNumber, weekdayName, termWeeks) {
  const wk = termWeeks.find((w) => !w.isReadingWeek && Number(w.weekNumber) === Number(weekNumber));
  if (!wk) return null;

  if (weekdayName == null) return wk.endDate; // "end of week N"

  const target = WEEKDAYS[String(weekdayName).toLowerCase()];
  if (target == null) return null;

  const start = new Date(`${wk.startDate}T12:00:00`);
  const end = new Date(`${wk.endDate}T12:00:00`);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === target) {
      return isoOf(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
  }
  return null;
}

/** The sentence around an offset, for the review queue to show as evidence. */
export function snippetAround(text, index, length, max = 240) {
  let start = index;
  let end = index + length;
  while (start > 0 && !/[.!?\n]/.test(text[start - 1]) && index - start < max) start--;
  while (end < text.length && !/[.!?\n]/.test(text[end]) && end - index < max) end++;
  return text.slice(start, end).replace(/\s+/g, ' ').trim().slice(0, max);
}

/** The line an offset sits on. */
function lineAround(text, index) {
  const s = text.lastIndexOf('\n', index - 1) + 1;
  let e = text.indexOf('\n', index);
  if (e === -1) e = text.length;
  return text.slice(s, e);
}

/**
 * Extract date candidates from a document.
 *
 * @returns Array<{
 *   date, kind, confidence, snippet, raw, reason, ambiguous, inTerm, index
 * }>
 *   kind: 'deadline' | 'range' | 'readingWeek' | 'lecture' | 'weekRelative'
 */
export function extractDates(text, opts = {}) {
  const {
    termStart = '2026-09-09',
    termEnd = '2026-12-08',
    termWeeks = [],
    calendarConfirmed = false,
    includeLectures = false,
  } = opts;

  if (!text) return [];

  const out = [];
  const seen = new Map();

  const RANK = { high: 3, medium: 2, low: 1 };
  const push = (c) => {
    // One candidate per date per sentence. "due Friday, November 13, 2026
    // (that is 11/13/2026)" is one deadline written twice, not two deadlines.
    const key = `${c.date}|${c.snippet}`;
    const prev = seen.get(key);
    if (prev) {
      // Keep whichever parse we trust more; the long form usually wins over a
      // bare numeric, which may be format-ambiguous.
      if (RANK[c.confidence] > RANK[prev.confidence]) Object.assign(prev, c);
      return;
    }
    seen.set(key, c);
    out.push(c);
  };

  /* ── absolute dates, long form ──────────────────────────────────────── */
  for (const re of [LONG_DATE, LONG_DATE_DMY]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      let month, day, year;
      if (re === LONG_DATE) {
        month = MONTHS[m[2].toLowerCase()];
        day = Number(m[3]);
        year = m[4] ? Number(m[4]) : null;
      } else {
        day = Number(m[1]);
        month = MONTHS[m[2].toLowerCase()];
        year = m[3] ? Number(m[3]) : null;
      }
      if (!month || !day) continue;

      let inferred = false;
      let inTerm;
      if (year == null) {
        const g = inferYear(month, day, termStart, termEnd);
        year = g.year;
        inTerm = g.inTerm;
        inferred = true;
      } else {
        const iso = isoOf(year, month, day);
        inTerm = iso >= termStart && iso <= termEnd;
      }
      if (!isValidYmd(year, month, day)) continue;

      push(
        classify({
          date: isoOf(year, month, day),
          index: m.index,
          raw: m[0].trim(),
          text,
          inTerm,
          yearInferred: inferred,
          ambiguous: false,
        })
      );
    }
  }

  /* ── absolute dates, numeric ────────────────────────────────────────── */
  NUMERIC_DATE.lastIndex = 0;
  let nm;
  while ((nm = NUMERIC_DATE.exec(text)) !== null) {
    let a = Number(nm[1]);
    let b = Number(nm[2]);
    let year = Number(nm[3]);
    if (year < 100) year += 2000;

    // Default to US month-first, which is what Waterloo outlines use, but say
    // so: 11/30 is unambiguous, 05/06 is not, and the reviewer must be told.
    let month = a;
    let day = b;
    let ambiguous = false;
    if (a > 12 && b <= 12) {
      month = b;
      day = a; // clearly day-first
    } else if (a <= 12 && b <= 12) {
      ambiguous = true;
    }
    if (!isValidYmd(year, month, day)) continue;

    const iso = isoOf(year, month, day);
    push(
      classify({
        date: iso,
        index: nm.index,
        raw: nm[0],
        text,
        inTerm: iso >= termStart && iso <= termEnd,
        yearInferred: false,
        ambiguous,
      })
    );
  }

  /* ── bare MM/DD — lecture-schedule rows ─────────────────────────────── */
  if (includeLectures) {
    BARE_MMDD.lastIndex = 0;
    let bm;
    while ((bm = BARE_MMDD.exec(text)) !== null) {
      const month = Number(bm[1]);
      const day = Number(bm[2]);
      if (month < 1 || month > 12 || day < 1 || day > 31) continue;
      const { year, inTerm } = inferYear(month, day, termStart, termEnd);
      if (!isValidYmd(year, month, day) || !inTerm) continue;
      push({
        date: isoOf(year, month, day),
        kind: 'lecture',
        confidence: 'low',
        snippet: snippetAround(text, bm.index, bm[0].length),
        raw: bm[0].trim(),
        reason: 'Bare MM/DD in a schedule table — a class date, not a deadline.',
        ambiguous: true,
        inTerm,
        index: bm.index,
      });
    }
  }

  /* ── week-relative ──────────────────────────────────────────────────── */
  WEEK_REL.lastIndex = 0;
  let wm;
  while ((wm = WEEK_REL.exec(text)) !== null) {
    const weekday = wm[1] || wm[4] || null;
    const weekNo = Number(wm[2] || wm[3] || wm[5]);
    if (!weekNo) continue;

    const resolved = termWeeks.length ? resolveWeekRelative(weekNo, weekday, termWeeks) : null;
    const snippet = snippetAround(text, wm.index, wm[0].length);

    push({
      date: resolved,
      kind: 'weekRelative',
      // A week-relative date can never be better than the calendar it resolves
      // against, and the calendar is a guess until the user confirms it.
      confidence: !resolved ? 'low' : calendarConfirmed ? 'medium' : 'low',
      snippet,
      raw: wm[0].trim(),
      reason: !resolved
        ? `Week ${weekNo} is not in the term calendar, so this could not be resolved.`
        : calendarConfirmed
          ? `Resolved against the confirmed term calendar (week ${weekNo}).`
          : `Resolved against an UNCONFIRMED term calendar (week ${weekNo}) — confirm the calendar before trusting this.`,
      ambiguous: !calendarConfirmed,
      inTerm: true,
      index: wm.index,
      weekNumber: weekNo,
      weekday,
    });
  }

  /* ── ranges and reading week ────────────────────────────────────────── */
  // Two absolute dates joined by "to"/"-" describe a span, not a deadline.
  const abs = out
    .filter((c) => c.kind === 'deadline' || c.kind === 'date')
    .sort((a, b) => a.index - b.index);

  for (let i = 0; i < abs.length - 1; i++) {
    const a = abs[i];
    const b = abs[i + 1];
    const between = text.slice(a.index + a.raw.length, b.index);
    if (between.length > 12 || !RANGE_JOIN.test(between)) continue;
    if (a.date >= b.date) continue;

    const line = lineAround(text, a.index);
    const isReading = READING_WEEK.test(line);
    a.kind = isReading ? 'readingWeek' : 'range';
    b.kind = isReading ? 'readingWeek' : 'range';
    a.rangeEnd = b.date;
    a.reason = isReading
      ? 'Reading week span — feeds the term calendar, never a deadline.'
      : 'Start of a date range, not a deadline.';
    b.reason = a.reason;
    a.confidence = isReading ? 'high' : 'low';
    b.confidence = a.confidence;
  }

  return out
    // A week reference that could not be resolved is kept deliberately, with a
    // null date. Dropping it would hide the fact that the document names a
    // deadline the calendar cannot place — silence is the one outcome that
    // must never happen here.
    .filter((c) => c.date || c.kind === 'weekRelative')
    .filter((c) => includeLectures || c.kind !== 'lecture')
    .sort((a, b) => a.index - b.index);
}

/**
 * Decide what a matched absolute date means and how much to trust it.
 *
 * Confidence is deliberately conservative: 'high' requires an explicit due
 * keyword, an explicit year, and a date inside the term. Anything inferred,
 * ambiguous or out-of-term drops a level.
 */
function classify({ date, index, raw, text, inTerm, yearInferred, ambiguous }) {
  const line = lineAround(text, index);
  const snippet = snippetAround(text, index, raw.length);
  const scope = `${line} ${snippet}`;

  // A minute-precise time straight after the date is a submission cutoff.
  const trailing = text.slice(index + raw.length, index + raw.length + 24);
  const timed = TIME_AFTER.test(trailing);
  const cutoff = timed && CUTOFF_TIME.test(trailing);

  const strong = STRONG_DUE.test(scope) || cutoff;
  const weak = WEAK_DUE.test(scope) || timed;
  const negated = NOT_DUE.test(line) && !STRONG_DUE.test(scope);

  // "Opens Thursday Oct 8 ... Closes Friday Oct 9" — the deadline is Closes.
  // Only the words immediately before the date count: scanning the whole line
  // up to the date would see the earlier "Opens" and wrongly demote "Closes".
  const preceding = text.slice(Math.max(0, index - 16), index);
  const isOpens = /\bopens?\b[\s,:]*$/i.test(preceding);

  let kind = strong || weak ? 'deadline' : 'date';
  let confidence;
  const reasons = [];

  if (strong) {
    confidence = 'high';
    reasons.push(
      STRONG_DUE.test(scope)
        ? 'an explicit due/deadline keyword sits beside it'
        : 'it is followed by an 11:59pm cutoff time, which marks a submission deadline'
    );
  } else if (weak) {
    confidence = 'medium';
    reasons.push('an assessment word is nearby, but no explicit "due"');
  } else {
    confidence = 'low';
    reasons.push('no deadline wording nearby');
  }

  if (!inTerm) {
    confidence = 'low';
    kind = 'outOfTerm';
    reasons.push(
      `the date falls OUTSIDE the term — very likely a previous term's document`
    );
  }
  if (yearInferred) {
    confidence = downgrade(confidence);
    reasons.push('the year was not written and had to be inferred');
  }
  if (ambiguous) {
    confidence = downgrade(confidence);
    reasons.push('the numeric format is ambiguous (read as US month/day)');
  }
  if (negated) {
    confidence = downgrade(confidence);
    reasons.push('the wording reads as an assigned/posted date rather than a due date');
  }
  if (isOpens) {
    confidence = downgrade(confidence);
    reasons.push('this looks like an "opens" date; the closing date is the real deadline');
  }

  return {
    date,
    kind,
    confidence,
    snippet,
    raw,
    reason: `${cap(reasons[0])}${reasons.length > 1 ? `; ${reasons.slice(1).join('; ')}` : ''}.`,
    ambiguous,
    inTerm,
    index,
  };
}

const downgrade = (c) => (c === 'high' ? 'medium' : 'low');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
