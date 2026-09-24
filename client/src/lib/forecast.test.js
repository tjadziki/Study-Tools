import test from 'node:test';
import assert from 'node:assert/strict';
import { examForecast, busyWeeks, mondayOf, addDays, daysBetween } from './forecast.js';
import { planWeek } from './plan.js';
import { score } from './deck.js';
import { d } from './dates.js';

const TODAY = '2026-09-23'; // a Wednesday

/* ── date helpers ────────────────────────────────────────────────────────── */

test('mondayOf finds the Monday on or before a date', () => {
  assert.equal(mondayOf('2026-09-23'), '2026-09-21'); // Wed
  assert.equal(mondayOf('2026-09-21'), '2026-09-21'); // Mon itself
  assert.equal(mondayOf('2026-09-27'), '2026-09-21'); // Sun
});

test('addDays and daysBetween agree across a month boundary', () => {
  assert.equal(addDays('2026-09-28', 5), '2026-10-03');
  assert.equal(daysBetween('2026-09-28', '2026-10-03'), 5);
});

/* ── 7. exam readiness ───────────────────────────────────────────────────── */

const exam = (id, courseId, dueDate, estHours, extra = {}) => ({
  id, courseId, course: courseId.toUpperCase(), title: id, kind: 'exam',
  weight: 30, estHours, dueDate, ...extra,
});

/** A plan day containing the given slots. */
const day = (date, slots) => ({ date, slots: slots.map((s) => ({ minutes: 90, done: false, spare: false, ...s })) });

test('an exam whose prep fits inside the daily target is on track', () => {
  const f = examForecast({
    todayIso: TODAY,
    exams: [exam('mid', 'mse331', '2026-10-29', 3)],
    planDays: [day('2026-10-20', [{ taskId: 'mid' }]), day('2026-10-22', [{ taskId: 'mid' }])],
  });
  assert.equal(f.rows[0].status, 'on-track');
  assert.equal(f.rows[0].plannedH, 3);
  assert.equal(f.rows[0].firstPrep, '2026-10-20');
});

test('prep that only fits in beyond-target blocks is tight', () => {
  const f = examForecast({
    todayIso: TODAY,
    exams: [exam('mid', 'mse331', '2026-10-29', 3)],
    planDays: [day('2026-10-20', [{ taskId: 'mid' }, { taskId: 'mid', spare: true }])],
  });
  assert.equal(f.rows[0].status, 'tight');
  assert.equal(f.rows[0].shortH, 1.5);
});

test('prep that does not fit at all is short, and says by how much', () => {
  const f = examForecast({
    todayIso: TODAY,
    exams: [exam('mid', 'mse331', '2026-10-29', 14)],
    planDays: [day('2026-10-27', [{ taskId: 'mid' }])],
  });
  assert.equal(f.rows[0].status, 'short');
  assert.equal(f.rows[0].shortH, 12.5);
  assert.match(f.rows[0].verdict, /Start prep now/);
});

test('blocks on or after the exam day do not count as prep for it', () => {
  const f = examForecast({
    todayIso: TODAY,
    exams: [exam('mid', 'mse331', '2026-10-29', 3)],
    planDays: [day('2026-10-29', [{ taskId: 'mid' }]), day('2026-10-30', [{ taskId: 'mid' }])],
  });
  assert.equal(f.rows[0].plannedH, 0);
});

test('hours already worked come off what is still needed', () => {
  const f = examForecast({
    todayIso: TODAY,
    exams: [exam('mid', 'mse331', '2026-10-29', 3)],
    planDays: [day('2026-10-20', [{ taskId: 'mid' }])],
    workedByTask: { mid: 90 },
  });
  assert.equal(f.rows[0].leftH, 1.5);
  assert.equal(f.rows[0].status, 'on-track');
});

test('retrieval blocks count toward that course’s next exam only', () => {
  const f = examForecast({
    todayIso: TODAY,
    exams: [exam('mid', 'me559', '2026-10-20', 3), exam('final', 'me559', '2026-12-10', 3)],
    planDays: [
      day('2026-10-01', [{ tag: 'retrieval', courseId: 'me559' }]), // -> midterm
      day('2026-11-01', [{ tag: 'retrieval', courseId: 'me559' }]), // -> final
    ],
  });
  const byId = Object.fromEntries(f.rows.map((r) => [r.id, r]));
  assert.equal(byId.mid.plannedH, 1.5);
  assert.equal(byId.final.plannedH, 1.5);
});

test('two exams on the same day each name the other', () => {
  const f = examForecast({
    todayIso: TODAY,
    exams: [exam('mse', 'mse331', '2026-10-29', 14), exam('mte', 'mte544', '2026-10-29', 10)],
    planDays: [],
  });
  for (const r of f.rows) {
    assert.equal(r.clashes.length, 1);
    assert.equal(r.clashes[0].sameDay, true);
  }
});

test('an exam with no date is listed as undated, not forecast', () => {
  const f = examForecast({ todayIso: TODAY, exams: [exam('final', 'mse331', null, 20)], planDays: [] });
  assert.equal(f.rows.length, 0);
  assert.equal(f.undated[0].status, 'undated');
});

test('the error-log floor is reported against the course’s entries', () => {
  const f = examForecast({
    todayIso: TODAY,
    exams: [exam('mid', 'mse331', '2026-10-29', 3)],
    planDays: [],
    errorCounts: { mse331: 4 },
    minErr: 15,
  });
  assert.equal(f.rows[0].errorsShort, 11);
});

/* ── the forecast against a real simulated plan ──────────────────────────── */

test('a simulated plan gives each of two same-day midterms its own prep', () => {
  const tasks = [
    { id: 'mse', courseId: 'mse331', title: 'MSE 331 midterm', kind: 'exam', weight: 35, estHours: 14, dueDate: '2026-10-29' },
    { id: 'mte', courseId: 'mte544', title: 'MTE 544 midterm', kind: 'exam', weight: 15, estHours: 10, dueDate: '2026-10-29' },
  ];
  const poolFor = (date) =>
    tasks
      .filter((t) => daysBetween(date, t.dueDate) <= 21 && t.dueDate >= date)
      .map((t) => ({ ...t, ...score(t, d(date).getTime()) }));
  const days = planWeek(
    { date: TODAY, poolFor, classBlocks: [], settings: {}, code: (x) => x },
    daysBetween(TODAY, '2026-10-29') + 1
  );
  const f = examForecast({ todayIso: TODAY, exams: tasks.map((t) => ({ ...t, course: t.courseId })), planDays: days });
  for (const r of f.rows) {
    assert.notEqual(r.status, 'short', `${r.title}: ${r.verdict}`);
    // Neither exam is admitted to the plan before its T-21.
    assert.ok(r.firstPrep >= '2026-10-08', `${r.title} prep started ${r.firstPrep}`);
  }
});

test('a pool is rescored for each simulated day, not frozen at today', () => {
  // An exam 36 days out is outside the 21-day horizon today, so with a frozen
  // pool it would never be planned at all.
  const t = { id: 'x', courseId: 'c', title: 'x', kind: 'exam', weight: 30, estHours: 6, dueDate: '2026-10-29' };
  const seen = [];
  const poolFor = (date) => {
    seen.push(date);
    return daysBetween(date, t.dueDate) <= 21 ? [{ ...t, ...score(t, d(date).getTime()) }] : [];
  };
  const days = planWeek({ date: TODAY, poolFor, classBlocks: [], settings: {}, code: (x) => x }, 37);
  assert.equal(seen.length, 37);
  assert.ok(days.some((x) => x.slots.some((s) => s.taskId === 'x')));
});

/* ── 8. busy weeks ───────────────────────────────────────────────────────── */

const task = (id, dueDate, estHours, extra = {}) => ({
  id, course: 'C', title: id, kind: 'work', weight: 5, estHours, dueDate,
  userConfirmed: true, ...extra,
});

test('two exams in one week make it heavy', () => {
  const r = busyWeeks({
    todayIso: TODAY,
    tasks: [
      task('mse', '2026-10-29', 1, { kind: 'exam' }),
      task('mte', '2026-10-29', 1, { kind: 'exam' }),
    ],
  });
  const wk = r.weeks.find((w) => w.mon === '2026-10-26');
  assert.equal(wk.level, 'heavy');
  assert.equal(wk.exams, 2);
});

test('a week whose deadlines need most of a week’s study time is heavy', () => {
  const r = busyWeeks({ todayIso: TODAY, tasks: [task('project', '2026-11-30', 25)] });
  // 25 h against 28 h of study in a week.
  assert.equal(r.weeks.find((w) => w.mon === '2026-11-30').level, 'heavy');
});

test('a light week is normal and carries no headline', () => {
  const r = busyWeeks({ todayIso: TODAY, tasks: [task('quiz', '2026-10-02', 0.5)] });
  const wk = r.weeks.find((w) => w.mon === '2026-09-28');
  assert.equal(wk.level, 'normal');
  assert.equal(wk.headline, null);
});

test('a heavy week says when its work has to start', () => {
  const r = busyWeeks({ todayIso: TODAY, tasks: [task('project', '2026-12-06', 40)] });
  const wk = r.weeks.find((w) => w.mon === '2026-11-30');
  // 40 h at 4 h a day is 10 days, finishing Sunday Dec 6: start Nov 27.
  assert.equal(wk.startBy, '2026-11-27');
  assert.match(wk.headline, /10 days of work/);
});

test('each item also gets its own start-by at the per-task pace', () => {
  const r = busyWeeks({ todayIso: TODAY, tasks: [task('project', '2026-12-06', 40)], hoursPerDay: 2 });
  const item = r.weeks.find((w) => w.mon === '2026-11-30').items[0];
  // 40 h at 2 h a day is 20 days before Dec 6.
  assert.equal(item.startBy, '2026-11-16');
});

test('work already done lightens the week', () => {
  const r = busyWeeks({
    todayIso: TODAY,
    tasks: [task('project', '2026-11-30', 25)],
    workedByTask: { project: 20 * 60 },
  });
  assert.equal(r.weeks.find((w) => w.mon === '2026-11-30').level, 'normal');
});

test('unconfirmed dates are shown but never counted', () => {
  const r = busyWeeks({
    todayIso: TODAY,
    tasks: [task('lab', null, 30, { userConfirmed: false, proposedDate: '2026-11-23' })],
  });
  const wk = r.weeks.find((w) => w.mon === '2026-11-23');
  assert.equal(wk, undefined, 'an unconfirmed date alone should not extend the scan');
  const r2 = busyWeeks({
    todayIso: TODAY,
    tasks: [
      task('lab', null, 30, { userConfirmed: false, proposedDate: '2026-11-23' }),
      task('anchor', '2026-11-27', 1),
    ],
  });
  const wk2 = r2.weeks.find((w) => w.mon === '2026-11-23');
  assert.equal(wk2.loadH, 1);
  assert.equal(wk2.tentative.length, 1);
});

test('weeks start from the current week and never from the past', () => {
  const r = busyWeeks({ todayIso: TODAY, tasks: [task('a', '2026-10-10', 1)] });
  assert.equal(r.weeks[0].mon, '2026-09-21');
  assert.equal(r.weeks[0].isThisWeek, true);
});

test('a week’s start-by respects an early deadline inside it', () => {
  // HW due Monday, two big items due Friday. Counting back from Sunday would
  // say "start Tuesday" — after the homework was due.
  const r = busyWeeks({
    todayIso: '2026-09-01',
    tasks: [
      task('hw', '2026-09-28', 6, { weight: 10 }),
      task('proposal', '2026-10-02', 12, { weight: 20 }),
      task('bc', '2026-10-02', 5, { weight: 15 }),
    ],
  });
  const wk = r.weeks.find((w) => w.mon === '2026-09-28');
  // Friday's 17 h at 4 h/day runs back to Monday 18:00; Monday's 6 h then
  // runs back into Sunday. So: start by Sunday Sep 27.
  assert.equal(wk.startBy, '2026-09-27');
});

test('a deadline weeks after the term is flagged as a probable slip', () => {
  const r = busyWeeks({
    todayIso: TODAY,
    endIso: '2026-12-08',
    tasks: [task('lab 4', '2026-12-30', 9), task('real', '2026-12-07', 1)],
  });
  assert.deepEqual(r.afterTerm.map((t) => t.id), ['lab 4']);
});

test('empty weeks after the term are dropped', () => {
  const r = busyWeeks({ todayIso: TODAY, endIso: '2026-12-08', tasks: [task('a', '2026-12-07', 1)] });
  assert.ok(r.weeks.every((w) => w.mon <= '2026-12-08'));
});

test('coverage never reads above 100% even when retrieval adds more', () => {
  const f = examForecast({
    todayIso: TODAY,
    exams: [exam('mid', 'mse331', '2026-10-29', 1.5)],
    planDays: [day('2026-10-20', [{ taskId: 'mid' }, { tag: 'retrieval', courseId: 'mse331' }])],
  });
  assert.equal(f.rows[0].plannedH, 1.5);
  assert.equal(f.rows[0].coveragePct, 100);
  assert.equal(f.rows[0].retrievalH, 1.5);
});
