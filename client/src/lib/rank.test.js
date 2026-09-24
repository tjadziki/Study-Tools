import test from 'node:test';
import assert from 'node:assert/strict';
import { rankTasks, tierOf, slackDays, TIER } from './plan.js';
import { score } from './deck.js';

// Today, for every test: Wed Sep 23 2026, noon.
const NOW = new Date(2026, 8, 23, 12).getTime();

const due = (daysAhead) => {
  const d = new Date(2026, 8, 23 + daysAhead, 12);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A task scored exactly as the deck scores it, then ranked. */
const make = (id, weight, estHours, daysAhead, extra = {}) => {
  const t = { id, title: id, weight, estHours, dueDate: daysAhead == null ? null : due(daysAhead), ...extra };
  return { ...t, ...score(t, NOW) };
};
const order = (tasks) => rankTasks(tasks).map((t) => t.id);

/* ── the case that was reported ──────────────────────────────────────────── */

test('an assignment due tomorrow outranks a discussion post due in four weeks', () => {
  // The exact rows from the triage screenshot. On priority score alone the
  // discussion wins 62.7 to 30.0, because the urgency term caps at 30.
  const discussion = make('Discussion 3', 5, 0.75, 28, { droppable: 1 });
  const assignment = make('ME 559 Assignment 1', 2.5, 5, 1, { droppable: 1 });
  assert.ok(discussion.priority > assignment.priority, 'precondition: the old score got this backwards');
  assert.deepEqual(order([discussion, assignment]), ['ME 559 Assignment 1', 'Discussion 3']);
});

test('the whole screenshot comes out in an order a person would defend', () => {
  const ranked = order([
    make('Discussion 3', 5, 0.75, 28, { droppable: 1 }),
    make('Discussion 4', 5, 0.75, 42, { droppable: 1 }),
    make('Discussion 5', 5, 0.75, 56, { droppable: 1 }),
    make('Term test 1', 15, 4, 16),
    make('Behaviour Change Pt 1', 15, 5, 9),
    make('Bonus quiz', 1, 0.5, 2, { droppable: 1 }),
    make('ME 559 Assignment 1', 2.5, 5, 1, { droppable: 1 }),
  ]);
  // Everything due within about a week is ranked by slack, tightest first.
  assert.deepEqual(ranked.slice(0, 3), ['ME 559 Assignment 1', 'Bonus quiz', 'Behaviour Change Pt 1']);
  // Nothing due in four or more weeks sits above anything due sooner.
  assert.deepEqual(ranked.slice(-3), ['Discussion 3', 'Discussion 4', 'Discussion 5']);
});

/* ── slack ───────────────────────────────────────────────────────────────── */

test('slack is days left minus the days of work left', () => {
  assert.equal(slackDays({ days: 10, estHours: 4 }, 2), 8);
  assert.equal(slackDays({ days: 1, estHours: 5 }, 2), -1.5);
  assert.equal(slackDays({ days: 999, estHours: 5 }, 2), null);
});

test('a big project turns urgent weeks before its date, a small quiz only days before', () => {
  // 40 hours at 2 h/day is 20 days of work, so 25 days out it has 5 of slack.
  assert.equal(tierOf({ days: 25, estHours: 40 }), TIER.URGENT);
  assert.equal(tierOf({ days: 25, estHours: 0.5 }), TIER.LATER);
});

test('overdue work is always urgent', () => {
  assert.equal(tierOf({ days: -5, estHours: 0.5 }), TIER.URGENT);
});

test('among urgent tasks, the one with least slack goes first', () => {
  const ranked = order([
    make('quiz due tomorrow', 1, 0.5, 1),
    make('project due in 4 days', 20, 12, 4),
  ]);
  // The quiz is due sooner, but the project has -2 days of slack against the
  // quiz's +0.75: the project is the one that is actually in trouble.
  assert.deepEqual(ranked, ['project due in 4 days', 'quiz due tomorrow']);
});

test('overdue work comes first so it is either submitted or marked done', () => {
  assert.equal(order([make('late form', 0, 0.5, -5), make('due tomorrow', 10, 5, 1)])[0], 'late form');
});

/* ── away from deadlines, value still decides ────────────────────────────── */

test('with room to breathe, marks per hour still decide', () => {
  const ranked = order([make('slow', 10, 10, 18), make('fast', 10, 2, 20)]);
  assert.deepEqual(ranked, ['fast', 'slow']);
});

test('dated work inside the horizon outranks undated work, which outranks later work', () => {
  const ranked = order([
    make('later', 30, 1, 40),
    make('undated', 30, 1, null),
    make('soon', 1, 1, 15),
  ]);
  assert.deepEqual(ranked, ['soon', 'undated', 'later']);
});

/* ── the ranking must be stable ──────────────────────────────────────────── */

test('ties break on id, so the order never reshuffles between renders', () => {
  const a = make('a', 5, 1, 30);
  const b = make('b', 5, 1, 30);
  assert.deepEqual(order([b, a]), ['a', 'b']);
  assert.deepEqual(order([a, b]), ['a', 'b']);
});

test('ranking does not mutate what it was given', () => {
  const input = [make('x', 5, 1, 3)];
  const snapshot = JSON.stringify(input);
  rankTasks(input);
  assert.equal(JSON.stringify(input), snapshot);
});
