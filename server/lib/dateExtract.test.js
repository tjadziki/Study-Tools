import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractDates, resolveWeekRelative, inferYear, isValidYmd, snippetAround,
} from './dateExtract.js';

const TERM = { termStart: '2026-09-09', termEnd: '2026-12-08' };

// The seeded best-guess calendar, with reading week as weekNumber 0 so it does
// not consume a lecture-week number.
const WEEKS = [
  { weekNumber: 1, startDate: '2026-09-09', endDate: '2026-09-13', isReadingWeek: 0 },
  { weekNumber: 2, startDate: '2026-09-14', endDate: '2026-09-20', isReadingWeek: 0 },
  { weekNumber: 3, startDate: '2026-09-21', endDate: '2026-09-27', isReadingWeek: 0 },
  { weekNumber: 4, startDate: '2026-09-28', endDate: '2026-10-04', isReadingWeek: 0 },
  { weekNumber: 5, startDate: '2026-10-05', endDate: '2026-10-09', isReadingWeek: 0 },
  { weekNumber: 0, startDate: '2026-10-10', endDate: '2026-10-18', isReadingWeek: 1 },
  { weekNumber: 6, startDate: '2026-10-19', endDate: '2026-10-25', isReadingWeek: 0 },
  { weekNumber: 7, startDate: '2026-10-26', endDate: '2026-11-01', isReadingWeek: 0 },
];

const opts = (extra = {}) => ({ ...TERM, termWeeks: WEEKS, ...extra });
const find = (rows, iso) => rows.find((r) => r.date === iso);

/* ── helpers ─────────────────────────────────────────────────────────────── */

test('isValidYmd rejects impossible calendar dates', () => {
  assert.equal(isValidYmd(2026, 2, 30), false);
  assert.equal(isValidYmd(2026, 13, 1), false);
  assert.equal(isValidYmd(2026, 11, 31), false); // November has 30
  assert.equal(isValidYmd(2026, 11, 30), true);
  assert.equal(isValidYmd(2024, 2, 29), true);   // leap year
  assert.equal(isValidYmd(2026, 2, 29), false);  // not a leap year
});

test('inferYear picks the year that lands inside the term', () => {
  assert.deepEqual(inferYear(11, 30, '2026-09-09', '2026-12-08'), { year: 2026, inTerm: true });
  // A March date fits no part of a Sep-Dec term.
  assert.equal(inferYear(3, 15, '2026-09-09', '2026-12-08').inTerm, false);
});

test('inferYear spans a term that crosses new year', () => {
  // Winter term: Jan belongs to the end year, not the start year.
  assert.deepEqual(inferYear(1, 20, '2026-12-28', '2027-04-10'), { year: 2027, inTerm: true });
});

/* ── week-relative resolution ────────────────────────────────────────────── */

test('resolveWeekRelative finds the right weekday inside the week', () => {
  assert.equal(resolveWeekRelative(5, 'Friday', WEEKS), '2026-10-09');
  assert.equal(resolveWeekRelative(2, 'Monday', WEEKS), '2026-09-14');
  assert.equal(resolveWeekRelative(3, 'wed', WEEKS), '2026-09-23');
});

test('reading week does not consume a lecture-week number', () => {
  // Week 6 is the week AFTER reading week. If reading week were counted as a
  // numbered week, this would wrongly return an October 10-18 date.
  assert.equal(resolveWeekRelative(6, 'Monday', WEEKS), '2026-10-19');
});

test('resolveWeekRelative returns the week end for "end of week"', () => {
  assert.equal(resolveWeekRelative(4, null, WEEKS), '2026-10-04');
});

test('resolveWeekRelative returns null for a week outside the calendar', () => {
  assert.equal(resolveWeekRelative(13, 'Friday', WEEKS), null);
  // Week 1 is a partial Wed-Sun week; it contains no Monday.
  assert.equal(resolveWeekRelative(1, 'Monday', WEEKS), null);
});

/* ── absolute dates: the real strings from this workspace ────────────────── */

test('HLTH 101: "Friday, September 25, 2026 at 11:59 PM" is a high-confidence deadline', () => {
  const text = 'Scholarly Journal Quiz\nDue Friday, September 25, 2026 at 11:59 PM\n1% Bonus';
  const r = find(extractDates(text, opts()), '2026-09-25');
  assert.ok(r, 'date was found');
  assert.equal(r.kind, 'deadline');
  assert.equal(r.confidence, 'high');
  assert.equal(r.inTerm, true);
});

test('ME 559: a detached ordinal leaves a stray space before the comma', () => {
  // The real extracted text, superscript "nd" having been split onto its own
  // line by the PDF layout pass.
  const text = 'nd\nDate/Time DUE: Wednesday October 22 , 2026 by 11:59pm';
  const r = find(extractDates(text, opts()), '2026-10-22');
  assert.ok(r, 'parsed despite the stray space');
  assert.equal(r.confidence, 'high');
});

test('ME 559: a last-year date is caught, not silently accepted', () => {
  // This is the actual line in ME559_Assignment2.pdf — those files are Fall 2025.
  const text = 'Date/Time DUE: Wednesday October 22 , 2025 by 11:59pm';
  const r = find(extractDates(text, opts()), '2025-10-22');
  assert.ok(r);
  assert.equal(r.kind, 'outOfTerm', 'flagged as outside the term');
  assert.equal(r.confidence, 'low');
  assert.match(r.reason, /OUTSIDE the term/);
});

test('a bare "N/A" due line yields no date', () => {
  assert.equal(extractDates('Date/Time DUE: N/A', opts()).length, 0);
});

/* ── numeric and ambiguous formats ───────────────────────────────────────── */

test('US numeric format parses month-first', () => {
  const r = find(extractDates('Submit by 11:59pm on 11/30/2026', opts()), '2026-11-30');
  assert.ok(r);
  assert.equal(r.kind, 'deadline');
});

test('an unambiguous day-first numeric is read correctly', () => {
  // 30 cannot be a month, so this is day/month regardless of convention.
  const r = find(extractDates('Due 30/11/2026', opts()), '2026-11-30');
  assert.ok(r);
  assert.equal(r.ambiguous, false);
});

test('an ambiguous numeric date is downgraded and says why', () => {
  // 05/06/2026 could be May 6 or June 5.
  const rows = extractDates('Due 05/06/2026', opts());
  const r = find(rows, '2026-05-06');
  assert.ok(r, 'read as US month/day');
  assert.equal(r.ambiguous, true);
  assert.notEqual(r.confidence, 'high');
  assert.match(r.reason, /ambiguous/);
});

test('two-digit years expand to 2000s', () => {
  assert.ok(find(extractDates('Due 11/30/26', opts()), '2026-11-30'));
});

/* ── things that must NOT become deadlines ───────────────────────────────── */

test('ME 524 lecture rows are excluded by default', () => {
  // Forty of these in the real outline. If they leaked in, they would bury the
  // review queue in false candidates.
  const text = [
    'Class Reading Concept',
    '09/10 \t - \t Introduction to Advanced Dynamics and Vibration',
    '09/15 \t 1.2 Review of ME 321, Harmonic Motion',
    '12/08 \t - \t Summary and Course wrap-up',
  ].join('\n');
  assert.deepEqual(extractDates(text, opts()), []);
});

test('lecture rows are still reachable when explicitly asked for', () => {
  const text = '09/10 \t - \t Introduction to Advanced Dynamics';
  const rows = extractDates(text, opts({ includeLectures: true }));
  const r = find(rows, '2026-09-10');
  assert.ok(r);
  assert.equal(r.kind, 'lecture');
  assert.equal(r.confidence, 'low');
});

test('a term-bounds range is a range, not a deadline', () => {
  const rows = extractDates('Lectures run September 9, 2026 to December 8, 2026.', opts());
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((r) => r.kind === 'range'), 'both ends marked as a range');
});

test('the reading-week span is recognised and kept out of the deadline flow', () => {
  // The exact string from HLTH 101's course schedule.
  const text = 'Reading Week (Saturday, October 10, 2026 to Sunday, October 18, 2026)';
  const rows = extractDates(text, opts());
  assert.equal(rows.length, 2);
  assert.ok(rows.every((r) => r.kind === 'readingWeek'));
  assert.equal(rows[0].date, '2026-10-10');
  assert.equal(rows[0].rangeEnd, '2026-10-18');
});

test('an "assigned" date is not treated as a due date', () => {
  const text = 'Date assigned: Monday October 6 , 2026';
  const r = find(extractDates(text, opts()), '2026-10-06');
  assert.ok(r);
  assert.notEqual(r.confidence, 'high');
});

/* ── opens/closes pairs ──────────────────────────────────────────────────── */

test('for an opens/closes pair the closing date is the stronger candidate', () => {
  const text = [
    'Term Test 1 on Modules 1-4',
    'Opens Thursday, October 8, 2026 at 11:59 PM',
    'Closes Friday, October 9, 2026 at 11:59 PM',
  ].join('\n');
  const rows = extractDates(text, opts());
  const opensRow = find(rows, '2026-10-08');
  const closesRow = find(rows, '2026-10-09');
  assert.ok(opensRow && closesRow);
  assert.equal(closesRow.confidence, 'high');
  assert.notEqual(opensRow.confidence, 'high');
});

/* ── week-relative confidence is gated on the calendar ───────────────────── */

test('week-relative stays low while the calendar is unconfirmed', () => {
  const rows = extractDates('Assignment 2 is due Friday of Week 5.', opts({ calendarConfirmed: false }));
  const r = rows.find((x) => x.kind === 'weekRelative');
  assert.ok(r);
  assert.equal(r.date, '2026-10-09');
  assert.equal(r.confidence, 'low');
  assert.match(r.reason, /UNCONFIRMED/);
});

test('week-relative rises to medium once the calendar is confirmed', () => {
  const rows = extractDates('Assignment 2 is due Friday of Week 5.', opts({ calendarConfirmed: true }));
  const r = rows.find((x) => x.kind === 'weekRelative');
  assert.equal(r.confidence, 'medium');
});

test('"Week 3 Wednesday" word order also resolves', () => {
  const rows = extractDates('Quiz in Week 3 Wednesday.', opts({ calendarConfirmed: true }));
  const r = rows.find((x) => x.kind === 'weekRelative');
  assert.equal(r.date, '2026-09-23');
});

test('an unresolvable week number reports itself rather than guessing', () => {
  const rows = extractDates('Due Friday of Week 12.', opts({ calendarConfirmed: true }));
  const r = rows.find((x) => x.kind === 'weekRelative');
  assert.ok(r);
  assert.equal(r.date, null);
  assert.match(r.reason, /not in the term calendar/);
});

/* ── snippets ────────────────────────────────────────────────────────────── */

test('the snippet carries the surrounding sentence as evidence', () => {
  const text = 'Some preamble. Project 2 is due Friday, November 13, 2026 at 5pm. More text.';
  const r = find(extractDates(text, opts()), '2026-11-13');
  assert.match(r.snippet, /Project 2 is due/);
  assert.ok(r.snippet.length <= 240);
});

test('snippetAround stops at sentence boundaries', () => {
  const text = 'First sentence. Target here. Third sentence.';
  const s = snippetAround(text, text.indexOf('Target'), 6);
  assert.equal(s, 'Target here');
});

/* ── robustness ──────────────────────────────────────────────────────────── */

test('empty and junk input produce no candidates and no throw', () => {
  assert.deepEqual(extractDates('', opts()), []);
  assert.deepEqual(extractDates(null, opts()), []);
  assert.deepEqual(extractDates('no dates in this text at all', opts()), []);
});

test('the same date written twice in one place is not duplicated', () => {
  const text = 'Due Friday, November 13, 2026 (that is 11/13/2026).';
  const rows = extractDates(text, opts()).filter((r) => r.date === '2026-11-13');
  assert.equal(rows.length, 1);
});

test('a document with many dates stays ordered by position', () => {
  const text = [
    'Assignment 1 due Friday, October 2, 2026.',
    'Assignment 2 due Friday, October 23, 2026.',
    'Assignment 3 due Friday, November 20, 2026.',
  ].join('\n');
  const rows = extractDates(text, opts());
  assert.deepEqual(
    rows.map((r) => r.date),
    ['2026-10-02', '2026-10-23', '2026-11-20']
  );
});
