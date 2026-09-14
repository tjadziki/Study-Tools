import test from 'node:test';
import assert from 'node:assert/strict';
import { matchComponent, scoreMatch, tokenise, numberedPhrases } from './match.js';

const HLTH = [
  { id: 'bc1', title: 'Behaviour Change Pt 1', weight: 15 },
  { id: 'bc2', title: 'Behaviour Change Pt 2', weight: 20 },
  { id: 'tt1', title: 'Term test 1', weight: 15 },
  { id: 'tt2', title: 'Term test 2', weight: 15 },
  { id: 'd1', title: 'Discussion 1 — Introduce yourself', weight: 5 },
  { id: 'quiz', title: 'Bonus quiz', weight: 1 },
];

test('tokenise drops stopwords and normalises synonyms', () => {
  assert.deepEqual(tokenise('Behaviour Change Pt 1'), ['behaviour', 'change', 'part', '1']);
  // "Assignment" is a stopword; "Pt" folds to "part".
  assert.deepEqual(tokenise('Assignment Pt 2'), ['part', '2']);
});

test('the real HLTH 101 schedule row matches Behaviour Change Pt 1', () => {
  const row =
    'Week 4 \t Psychological Health \t Behaviour Change Assignment Part 1 \t Friday, October 2, 2026 at 11:59 PM \t 15%';
  const { component } = matchComponent({ snippet: row }, HLTH);
  assert.equal(component?.id, 'bc1');
});

test('Part 1 and Part 2 are never confused', () => {
  const row2 =
    'Week 12 \t Health Care \t Behaviour Change Assignment Part 2 \t Friday, December 4, 2026 at 11:59 PM \t 20%';
  assert.equal(matchComponent({ snippet: row2 }, HLTH).component?.id, 'bc2');
});

test('a digit mismatch disqualifies a match outright', () => {
  // Same words, wrong number: must not fall through to Part 1.
  assert.equal(scoreMatch('Behaviour Change Pt 1', 'Behaviour Change Part 3'), 0);
});

test('the term test row matches on number and weight', () => {
  const row =
    'Week 5 \t Stress \t Term Test 1 on Modules 1-4 \t Closes Friday, October 9, 2026 at 11:59 PM \t 15%';
  assert.equal(matchComponent({ snippet: row }, HLTH).component?.id, 'tt1');
});

test('an unrelated row matches nothing rather than guessing', () => {
  const row = 'Week 7 \t Drug Use and Addiction';
  const { component } = matchComponent({ snippet: row }, HLTH);
  assert.equal(component, null);
});

test('two equally good candidates are reported ambiguous, not guessed', () => {
  const twins = [
    { id: 'a', title: 'Midterm', weight: 30 },
    { id: 'b', title: 'Midterm', weight: 30 },
  ];
  const { component, ambiguous } = matchComponent({ snippet: 'The Midterm is due soon' }, twins);
  assert.equal(component, null);
  assert.equal(ambiguous, true);
});

test('a matching weight in the row lifts a partial title match', () => {
  const weak = scoreMatch('Bonus quiz', 'Scholarly Journal Quiz — Friday September 25');
  const lifted = scoreMatch('Bonus quiz', 'Scholarly Journal Quiz \t 1% Bonus', 1);
  assert.ok(lifted > weak, 'the 1% in the row corroborates the match');
});

test('scores stay within 0..1', () => {
  const s = scoreMatch('Term test 1', 'Term Test 1 on Modules 1-4 \t 15%', 15);
  assert.ok(s > 0 && s <= 1, `score ${s} in range`);
});

/* ── regressions found against the real HLTH 101 schedule ────────────────── */

const DISCUSSIONS = [
  { id: 'd1', title: 'Discussion 1 — Introduce yourself', weight: 5 },
  { id: 'd2', title: 'Discussion 2 — Racism as a determinant of health', weight: 5 },
  { id: 'd3', title: 'Discussion 3 — Stress and health', weight: 5 },
  { id: 'd4', title: 'Discussion 4 — The fentanyl epidemic', weight: 5 },
  { id: 'd5', title: 'Discussion 5 — COVID-19 pandemic', weight: 5 },
];

test('the "Week 2" cell does not lend its digit to Discussion 2', () => {
  // The real week-2 row. Its deliverable is Discussion 1; only the schedule
  // scaffolding says "2", and that must not select "Discussion 2".
  const row =
    'Week 2 \t Current Health Challenges \t Introduce Yourself Group Discussion \t Original Posts: Wednesday, September 16, 2026 at 11:59 PM Reply Post: Friday, September 18, 2026 at 11:59 PM \t 5% (Best 4/5)';
  assert.equal(matchComponent({ snippet: row }, DISCUSSIONS).component?.id, 'd1');
});

test('rare topic words outrank the words every discussion shares', () => {
  // "health" appears in several titles; "racism" appears in exactly one.
  const row =
    'Racism as a Determinant of Health Group Discussion \t Original Posts: Wednesday, September 23, 2026 at 11:59 PM Reply Post: Friday, September 25, 2026 at 11:59 PM \t 5% (Best 4/5)';
  assert.equal(matchComponent({ snippet: row }, DISCUSSIONS).component?.id, 'd2');
});

test('each real discussion row picks out its own discussion', () => {
  const rows = {
    d3: 'Week 6 \t Managing Stress \t Stress and Health Group Discussion \t Original Posts: Wednesday, October 21, 2026 \t 5% (Best 4/5)',
    d4: 'Week 8 \t Types of Psychoactive Drugs \t Fentanyl Epidemic Group Discussion \t Original Posts: Wednesday, November 4, 2026 \t 5% (Best 4/5)',
    d5: 'Week 10 \t Pathogens and Infections \t COVID-19 Pandemic Group Discussion \t Original Posts: Wednesday, November 18, 2026 \t 5% (Best 4/5)',
  };
  for (const [id, row] of Object.entries(rows)) {
    assert.equal(matchComponent({ snippet: row }, DISCUSSIONS).component?.id, id, `row for ${id}`);
  }
});

test('a bare number like "Best 4/5" is not read as a deliverable number', () => {
  const { part } = numberedPhrases('Behaviour Change Assignment Part 1 \t 5% (Best 4/5)');
  assert.equal(part, '1');
  assert.equal(numberedPhrases('15% \t Best 4/5').part, undefined);
});
