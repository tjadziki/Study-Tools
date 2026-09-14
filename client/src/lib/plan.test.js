import test from 'node:test';
import assert from 'node:assert/strict';
import { hhmm, mergeRanges, freeWindows, splitWindow, planDay, planWeek } from './plan.js';

const SETTINGS = {
  dayStartMin: '450',
  dayEndMin: '1260',
  dailyTargetHours: '4',
  weekendTargetHours: '4',
  minBlockMinutes: '45',
  maxBlockMinutes: '110',
  breakMinutes: '15',
  classBufferMinutes: '15',
  minErrorsAtT14: '15',
};

// The real timetable, so the tests fail if the seeded schedule drifts.
const BLOCKS = [
  { id: 'a', courseId: 'me548', weekday: 1, startMin: 600, endMin: 680, kind: 'LEC' },
  { id: 'b', courseId: 'me597', weekday: 1, startMin: 690, endMin: 770, kind: 'LEC' },
  { id: 'c', courseId: 'me524', weekday: 2, startMin: 750, endMin: 860, kind: 'LEC' },
  { id: 'd', courseId: 'me481', weekday: 2, startMin: 960, endMin: 1040, kind: 'PRJ' },
  { id: 'e', courseId: 'me548', weekday: 5, startMin: 990, endMin: 1160, kind: 'LAB' },
];

const task = (id, over = {}) => ({
  id,
  courseId: 'me548',
  title: id,
  weight: 20,
  estHours: 10,
  kind: 'work',
  days: 10,
  mph: 2,
  priority: 30,
  ...over,
});

const base = (over = {}) => ({
  date: '2026-09-14', // a Monday
  scored: [],
  classBlocks: BLOCKS,
  settings: SETTINGS,
  code: (id) => id.toUpperCase(),
  ...over,
});

/* ── the arithmetic ──────────────────────────────────────────────────────── */

test('hhmm formats minutes from midnight', () => {
  assert.equal(hhmm(450), '07:30');
  assert.equal(hhmm(1260), '21:00');
  assert.equal(hhmm(0), '00:00');
});

test('overlapping and touching ranges merge', () => {
  assert.deepEqual(mergeRanges([[600, 680], [670, 700]]), [[600, 700]]);
  assert.deepEqual(mergeRanges([[600, 680], [680, 700]]), [[600, 700]]);
  assert.deepEqual(mergeRanges([[600, 680], [900, 940]]), [[600, 680], [900, 940]]);
});

test('empty ranges are dropped rather than merged', () => {
  assert.deepEqual(mergeRanges([[600, 600], [700, 740]]), [[700, 740]]);
});

test('free windows are the day minus the classes', () => {
  assert.deepEqual(freeWindows([[600, 680]], 450, 1260), [[450, 600], [680, 1260]]);
});

test('a class running past the end of the study window leaves no tail', () => {
  assert.deepEqual(freeWindows([[1100, 1400]], 450, 1260), [[450, 1100]]);
});

test('a day with no classes is one window', () => {
  assert.deepEqual(freeWindows([], 450, 1260), [[450, 1260]]);
});

test('a window shorter than one block yields no slots', () => {
  assert.deepEqual(splitWindow(600, 640, { minBlock: 45, maxBlock: 110, breakMin: 15 }), []);
});

test('every block stays inside the min and max, with breaks between', () => {
  const slots = splitWindow(450, 990, { minBlock: 45, maxBlock: 110, breakMin: 15 });
  assert.ok(slots.length >= 5, `expected the long window to split, got ${slots.length}`);
  for (const [s, e] of slots) {
    const len = e - s;
    assert.ok(len >= 45 && len <= 110, `block of ${len} min is outside 45–110`);
  }
  for (let i = 1; i < slots.length; i += 1) {
    assert.equal(slots[i][0] - slots[i - 1][1], 15, 'blocks must be separated by one break');
  }
  assert.ok(slots[slots.length - 1][1] <= 990, 'the last block must not run past the window');
});

test('blocks never overrun the window they came from', () => {
  for (let total = 45; total <= 700; total += 7) {
    for (const [s, e] of splitWindow(450, 450 + total, { minBlock: 45, maxBlock: 110, breakMin: 15 })) {
      assert.ok(s >= 450 && e <= 450 + total, `block ${s}-${e} escaped a ${total}-minute window`);
    }
  }
});

/* ── the day ─────────────────────────────────────────────────────────────── */

test('Monday classes are picked up and never overlap a study slot', () => {
  const day = planDay(base({ scored: [task('t1')] }));
  assert.equal(day.classes.length, 2);
  assert.equal(day.classes[0].timeStr, '10:00 – 11:20');
  for (const s of day.slots) {
    for (const c of day.classes) {
      assert.ok(s.endMin <= c.startMin || s.startMin >= c.endMin, `slot ${s.timeStr} collides with ${c.timeStr}`);
    }
  }
});

test('a slot never starts before the day starts or ends after bedtime', () => {
  for (const date of ['2026-09-14', '2026-09-15', '2026-09-18', '2026-09-19']) {
    for (const s of planDay(base({ date, scored: [task('t1')] })).slots) {
      assert.ok(s.startMin >= 450 && s.endMin <= 1260, `${date}: ${s.timeStr} is outside the study window`);
    }
  }
});

test('the travel buffer keeps a slot off the edge of a class', () => {
  const day = planDay(base({ scored: [task('t1')] }));
  const before = day.slots.filter((s) => s.endMin <= 600);
  assert.ok(before.length > 0);
  assert.ok(before[before.length - 1].endMin <= 585, 'a slot ran up to the lecture door');
});

test('a free Saturday has more capacity than a teaching Monday', () => {
  const sat = planDay(base({ date: '2026-09-19', scored: [task('t1')] }));
  const mon = planDay(base({ scored: [task('t1')] }));
  assert.ok(sat.capacityMin > mon.capacityMin);
  assert.equal(sat.weekend, true);
  assert.equal(mon.weekend, false);
});

test('the highest-priority task is what the first working slot gets', () => {
  const day = planDay(
    base({
      scored: [task('big', { title: 'Project 1' }), task('small', { title: 'Quiz' })],
    })
  );
  const work = day.slots.find((s) => s.tag === 'deliverable');
  assert.equal(work.title, 'Project 1');
});

test('one task cannot take more than two blocks in a day while it is far off', () => {
  const day = planDay(base({ date: '2026-09-19', scored: [task('t1', { estHours: 40 })] }));
  const mine = day.slots.filter((s) => s.taskId === 't1');
  assert.equal(mine.length, 2);
});

test('a task due inside 48 hours is allowed to take the whole day', () => {
  const day = planDay(base({ date: '2026-09-19', scored: [task('t1', { estHours: 40, days: 1 })] }));
  const mine = day.slots.filter((s) => s.taskId === 't1');
  assert.ok(mine.length > 2, `expected an urgent task to take over, got ${mine.length} blocks`);
});

test('a task is retired once its estimate is used up', () => {
  const day = planDay(base({ date: '2026-09-19', scored: [task('t1', { estHours: 1, days: 1 })] }));
  assert.equal(day.slots.filter((s) => s.taskId === 't1').length, 1);
});

test('the action text tracks how far out the deadline is', () => {
  const soon = planDay(base({ scored: [task('t1', { days: 1 })] })).slots.find((s) => s.taskId === 't1');
  const far = planDay(base({ scored: [task('t1', { days: 30 })] })).slots.find((s) => s.taskId === 't1');
  assert.match(soon.action, /Final pass/);
  assert.match(far.action, /Open it early/);
  assert.match(soon.why, /due tomorrow/);
});

test('an exam slot follows the taper rather than the deliverable wording', () => {
  const day = planDay(base({ scored: [task('x', { kind: 'exam', days: 5 })] }));
  const slot = day.slots.find((s) => s.taskId === 'x');
  assert.equal(slot.tag, 'exam');
  assert.match(slot.action, /T-7/);
});

/* ── the empty-deck case, which is the whole point ───────────────────────── */

test('with nothing due, the day fills with retrieval and reading, not blanks', () => {
  const day = planDay(
    base({
      date: '2026-09-19',
      scored: [],
      examCourses: [{ id: 'me524' }, { id: 'me548' }],
      unknownCourses: [{ id: 'me597' }],
      errorCounts: { me524: 3 },
    })
  );
  const tags = new Set(day.slots.map((s) => s.tag));
  assert.ok(tags.has('retrieval'), 'expected retrieval practice to fill an empty day');
  assert.ok(tags.has('read'), 'expected the unknown-weights course to get a reading block');
  assert.equal(day.slots.some((s) => s.tag === 'spare' && !s.title.startsWith('Nothing')), false);
});

test('a retrieval block says how many entries are still missing', () => {
  const day = planDay(
    base({ date: '2026-09-19', examCourses: [{ id: 'me524' }], errorCounts: { me524: 3 } })
  );
  const slot = day.slots.find((s) => s.tag === 'retrieval');
  assert.match(slot.action, /12 more entries/);
});

test('a stale stuck concept outranks routine retrieval', () => {
  const day = planDay(
    base({
      date: '2026-09-19',
      examCourses: [{ id: 'me524' }],
      staleConcepts: [{ courseId: 'me524', text: 'modal superposition' }],
    })
  );
  const first = day.slots.find((s) => s.tag === 'unblock' || s.tag === 'retrieval');
  assert.equal(first.tag, 'unblock');
  assert.match(first.title, /modal superposition/);
});

test('a genuinely empty deck admits it instead of inventing work', () => {
  const day = planDay(base({ date: '2026-09-19' }));
  assert.ok(day.slots.every((s) => s.tag === 'spare'));
  assert.match(day.slots[0].action, /Rest/);
});

/* ── materials ───────────────────────────────────────────────────────────── */

const MATERIALS = {
  me548: [
    { name: 'Lecture 4.pdf', kind: 'lecture' },
    { name: 'Sample Final Exam.pdf', kind: 'exam' },
    { name: 'ME548 CNC MasterCAM brief.pdf', kind: 'assignment' },
  ],
};

test('a deliverable block opens the file whose name matches the task', () => {
  const slot = planDay(
    base({
      scored: [task('t1', { title: 'Project 1 — CNC / MasterCAM / CMM' })],
      materialsByCourse: MATERIALS,
    })
  ).slots.find((s) => s.tag === 'deliverable');
  assert.equal(slot.material.name, 'ME548 CNC MasterCAM brief.pdf');
});

test('an exam block falls back to the past paper with no name match at all', () => {
  const slot = planDay(
    base({ scored: [task('x', { kind: 'exam', days: 5 })], materialsByCourse: MATERIALS })
  ).slots.find((s) => s.tag === 'exam');
  assert.equal(slot.material.name, 'Sample Final Exam.pdf');
});

test('a deliverable with no matching file gets none, rather than a wrong one', () => {
  // The whole point: the newest assignment in a course is not necessarily the
  // brief for *this* deliverable, and a confidently wrong file wastes a block.
  const slot = planDay(
    base({ scored: [task('t1', { title: 'Behaviour Change Pt 2' })], materialsByCourse: MATERIALS })
  ).slots.find((s) => s.tag === 'deliverable');
  assert.equal(slot.material, null);
});

test('a course with no scanned files simply gets no material', () => {
  const slot = planDay(base({ scored: [task('t1')] })).slots.find((s) => s.tag === 'deliverable');
  assert.equal(slot.material, null);
});

/* ── near work before cheap work that is months away ─────────────────────── */

test('a cheap task months out does not outrank real work inside the horizon', () => {
  // 5% over 45 minutes scores 6.7 marks/hour; 18% over 22 hours scores 0.8.
  // On marks/hour alone the discussion post would take the whole day.
  const day = planDay(
    base({
      date: '2026-09-19',
      scored: [
        task('cheap', { title: 'Discussion 5', weight: 5, estHours: 0.75, days: 66, mph: 6.7, priority: 67 }),
        task('real', { title: 'Project 1', weight: 18, estHours: 22, days: 12, mph: 0.8, priority: 10 }),
      ],
    })
  );
  const titles = day.slots.map((s) => s.title);
  assert.equal(titles[0], 'Project 1', 'the day must open on the work that is actually near');
  assert.ok(
    titles.indexOf('Project 1') < titles.indexOf('Discussion 5'),
    `near work must come first, got ${titles.join(', ')}`
  );
});

test('work beyond the horizon still fills the blocks past the target', () => {
  const day = planDay(
    base({
      date: '2026-09-19',
      scored: [
        task('far', { title: 'Discussion 5', estHours: 4, days: 66 }),
        task('near', { title: 'Project 1', estHours: 3, days: 12 }),
      ],
    })
  );
  const spare = day.slots.filter((s) => s.spare);
  assert.ok(spare.some((s) => s.title === 'Discussion 5'), 'expected the far task to be pulled ahead');
  assert.match(spare.find((s) => s.title === 'Discussion 5').why, /getting ahead|marks\/hour/);
});

test('keeping an exam course warm beats starting work due in two months', () => {
  const day = planDay(
    base({
      date: '2026-09-19',
      scored: [task('far', { title: 'Discussion 5', estHours: 8, days: 66 })],
      examCourses: [{ id: 'me524' }],
      errorCounts: { me524: 2 },
    })
  );
  assert.equal(day.slots[0].tag, 'retrieval');
});

test('an undated task counts as near — undated is exactly what needs scoping', () => {
  const day = planDay(
    base({ date: '2026-09-19', scored: [task('t1', { title: 'Midterm prep', days: 999 })] })
  );
  assert.equal(day.slots[0].taskId, 't1');
  assert.match(day.slots[0].action, /Scope it/);
});

test('a block longer than the work left in a task says so', () => {
  const day = planDay(base({ date: '2026-09-19', scored: [task('t1', { estHours: 0.5, days: 5 })] }));
  assert.match(day.slots[0].why, /only ~30 min of estimate left/);
});

/* ── consolidation ───────────────────────────────────────────────────────── */

test('the block after the last lecture is spent rewriting its notes', () => {
  const day = planDay(base({ scored: [task('t1'), task('t2'), task('t3')] }));
  const c = day.slots.find((s) => s.tag === 'consolidate');
  assert.ok(c, 'expected a consolidation block on a teaching day');
  assert.equal(c.courseId, 'me597', 'it should follow the last class of the day');
  assert.ok(c.startMin >= 770, 'it must come after that class ends');
});

test('at most one consolidation block a day', () => {
  const day = planDay(base({ scored: [task('t1'), task('t2')] }));
  assert.equal(day.slots.filter((s) => s.tag === 'consolidate').length, 1);
});

test('a day with no classes gets no consolidation block', () => {
  const day = planDay(base({ date: '2026-09-19', scored: [task('t1')] }));
  assert.equal(day.slots.some((s) => s.tag === 'consolidate'), false);
});

/* ── targets ─────────────────────────────────────────────────────────────── */

test('slots past the daily target are marked spare, not dropped', () => {
  const day = planDay(base({ date: '2026-09-19', scored: [task('t1', { estHours: 40, days: 1 })] }));
  assert.ok(day.slots.some((s) => s.spare), 'a free Saturday exceeds four hours');
  assert.ok(day.committedMin >= 240, 'the committed block should reach the target');
  assert.equal(day.targetMin, 240);
});

test('doneMin counts only the slots actually ticked', () => {
  const day = planDay(
    base({ date: '2026-09-19', scored: [task('t1', { estHours: 40, days: 1 })], doneKeys: new Set(['450']) })
  );
  const first = day.slots[0];
  assert.equal(first.done, true);
  assert.equal(day.doneMin, first.minutes);
  assert.equal(day.metTarget, false);
});

test('a day too full of classes to hit the target says so', () => {
  const packed = [
    { id: 'p1', courseId: 'me548', weekday: 1, startMin: 460, endMin: 800, kind: 'LEC' },
    { id: 'p2', courseId: 'me559', weekday: 1, startMin: 830, endMin: 1250, kind: 'LEC' },
  ];
  const day = planDay(base({ classBlocks: packed, scored: [task('t1')] }));
  assert.equal(day.shortOfCapacity, true);
});

/* ── the week ────────────────────────────────────────────────────────────── */

test('a week retires a task rather than showing it on all seven days', () => {
  const week = planWeek(base({ scored: [task('t1', { estHours: 4 })] }));
  assert.equal(week.length, 7);
  const totalBlocks = week.reduce((a, day) => a + day.slots.filter((s) => s.taskId === 't1').length, 0);
  assert.ok(totalBlocks <= 4, `4 hours of work should not stretch over ${totalBlocks} blocks`);
  assert.equal(week[6].slots.some((s) => s.taskId === 't1'), false);
});

test('the week starts on the day it is given', () => {
  const week = planWeek(base({ date: '2026-09-14' }));
  assert.deepEqual(week.map((x) => x.date).slice(0, 3), ['2026-09-14', '2026-09-15', '2026-09-16']);
});

test('the first day of the week is the same plan as that day alone', () => {
  const args = base({ scored: [task('t1'), task('t2', { priority: 20 })] });
  assert.deepEqual(
    planWeek(args)[0].slots.map((s) => [s.key, s.taskId]),
    planDay(args).slots.map((s) => [s.key, s.taskId])
  );
});

test('planning does not mutate the spent budget it was handed', () => {
  const spent = { t1: 60 };
  planDay(base({ scored: [task('t1')], spent }));
  assert.deepEqual(spent, { t1: 60 });
});

test('the same inputs always produce the same plan', () => {
  const args = base({ scored: [task('t1'), task('t2')] });
  const a = JSON.stringify(planDay(args).slots);
  const b = JSON.stringify(planDay(args).slots);
  assert.equal(a, b);
});

test('the part number decides between two otherwise identical templates', () => {
  const materialsByCourse = {
    me548: [
      // Newest first, as the scanner returns them — so Part 2 wins any tie.
      { name: 'behaviour-change-assignment-part-2-template.docx', kind: 'assignment' },
      { name: 'behaviour-change-assignment-part-1-template.docx', kind: 'assignment' },
    ],
  };
  const one = planDay(
    base({ scored: [task('t1', { title: 'Behaviour Change Pt 1' })], materialsByCourse })
  ).slots.find((s) => s.tag === 'deliverable');
  const two = planDay(
    base({ scored: [task('t2', { title: 'Behaviour Change Pt 2' })], materialsByCourse })
  ).slots.find((s) => s.tag === 'deliverable');
  assert.match(one.material.name, /part-1/);
  assert.match(two.material.name, /part-2/);
});

test('the consolidation block is worded for the kind of class it follows', () => {
  const lab = planDay(
    base({ date: '2026-09-18', scored: [task('t1'), task('t2'), task('t3')] })
  ).slots.find((s) => s.tag === 'consolidate');
  const prj = planDay(
    base({ date: '2026-09-15', scored: [task('t1'), task('t2'), task('t3')] })
  ).slots.find((s) => s.tag === 'consolidate');
  assert.match(lab.title, /lab/i);
  assert.match(prj.title, /project meeting/i);
  assert.doesNotMatch(prj.title, /lecture/i);
});
