import test from 'node:test';
import assert from 'node:assert/strict';
import { collapseToCutoff } from './candidates.js';

const c = (date, index, snippet, confidence = 'high') => ({
  date, index, snippet, confidence, reason: 'because.', kind: 'deadline',
});

test('an opens/closes pair collapses to the closing date', () => {
  const row = 'Term Test 1 \t Opens Thursday, October 8 Closes Friday, October 9 \t 15%';
  const out = collapseToCutoff([c('2026-10-08', 10, row, 'medium'), c('2026-10-09', 60, row)]);
  assert.equal(out.length, 1);
  assert.equal(out[0].date, '2026-10-09');
  assert.match(out[0].reason, /cutoff of 2 dates/);
});

test('an original/reply discussion pair collapses to the reply date', () => {
  const row = 'Introduce Yourself Group Discussion \t Original Posts: Wed Sep 16 Reply Post: Fri Sep 18 \t 5%';
  const out = collapseToCutoff([c('2026-09-16', 5, row), c('2026-09-18', 70, row)]);
  assert.equal(out.length, 1);
  assert.equal(out[0].date, '2026-09-18');
});

test('dates in different rows are never merged', () => {
  const out = collapseToCutoff([
    c('2026-10-02', 5, 'Behaviour Change Part 1 \t Friday, October 2'),
    c('2026-12-04', 90, 'Behaviour Change Part 2 \t Friday, December 4'),
  ]);
  assert.equal(out.length, 2);
});

test('two far-apart dates in one sentence are kept separate', () => {
  // Beyond the 14-day guard: these are two deadlines, not one deliverable.
  const s = 'Proposal due October 6 and the final report due December 8.';
  const out = collapseToCutoff([c('2026-10-06', 5, s), c('2026-12-08', 40, s)]);
  assert.equal(out.length, 2);
});

test('a single candidate passes through untouched', () => {
  const one = c('2026-11-30', 3, 'Major project due November 30');
  const out = collapseToCutoff([one]);
  assert.equal(out.length, 1);
  assert.equal(out[0].reason, 'because.');
});

test('output stays ordered by position in the document', () => {
  const out = collapseToCutoff([
    c('2026-12-04', 200, 'row C'),
    c('2026-10-02', 10, 'row A'),
    c('2026-11-06', 100, 'row B'),
  ]);
  assert.deepEqual(out.map((x) => x.snippet), ['row A', 'row B', 'row C']);
});
