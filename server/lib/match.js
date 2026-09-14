// Matching a date candidate to the component it belongs to.
//
// Deliberately conservative. A wrong match silently attaches a real date to the
// wrong deliverable, which is worse than no match at all — an unmatched
// candidate merely shows up in the review queue as "new item proposed", which
// the user can dismiss in one click.

/** Words that carry no distinguishing information in a component title. */
const STOP = new Set([
  'the', 'a', 'an', 'of', 'on', 'in', 'for', 'and', 'to', 'at', 'by', 'is', 'as',
  'assignment', 'group', 'course', 'week', 'due', 'date', 'submission', 'posts', 'post',
]);

/** Spellings that mean the same thing across an outline and a LEARN page. */
const SYNONYM = {
  pt: 'part', p: 'part', asgn: 'assign', assn: 'assign',
  hw: 'homework', proj: 'project', mt: 'midterm', disc: 'discussion',
};

const MONTH_WORDS =
  'jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december';

/**
 * A keyword immediately followed by a number — "Part 1", "Term Test 2".
 * These are the numbers that identify WHICH deliverable something is; bare
 * numbers like "15%", "Best 4/5" or "Modules 1-4" are noise.
 */
const NUMBERED = /\b(part|pt|assignment|assign|project|proj|quiz|test|midterm|exam|discussion|lab|milestone|report|no|number|#)\s*#?\s*(\d+)\b/gi;

/**
 * Remove date and time text, and schedule scaffolding, before matching titles.
 *
 * Without this, "Behaviour Change Assignment Part 1 … October 2, 2026" lends
 * the digit 2 to the row, so "Behaviour Change Pt 2" scores exactly as well as
 * "Pt 1". The same goes for the "Week 2" cell at the head of a schedule row.
 * Neither the date nor the week number gets to vote on which deliverable a
 * deadline belongs to.
 */
export function stripDates(s) {
  return String(s || '')
    .replace(new RegExp(`\\b(?:${MONTH_WORDS})\\.?\\s+\\d{1,2}\\s*(?:st|nd|rd|th)?\\s*,?\\s*(?:\\d{4})?`, 'gi'), ' ')
    .replace(new RegExp(`\\b\\d{1,2}\\s*(?:st|nd|rd|th)?\\s+(?:${MONTH_WORDS})\\b\\.?\\s*,?\\s*(?:\\d{4})?`, 'gi'), ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, ' ')  // 11/30/2026
    .replace(/\b\d{1,2}:\d{2}\s*(?:am|pm)?/gi, ' ')            // 11:59 PM
    .replace(/\b\d{1,2}\s*(?:am|pm)\b/gi, ' ')                 // 5pm
    .replace(/\b(?:19|20)\d{2}\b/g, ' ')                       // stray years
    .replace(/\bweeks?\s*\d{1,2}\b/gi, ' ')                    // "Week 2" scaffolding
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenise(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOP.has(t))
    .map((t) => SYNONYM[t] || t);
}

/** Extract identifying "keyword N" pairs, e.g. { part: '1', test: '2' }. */
export function numberedPhrases(s) {
  const out = {};
  const bare = stripDates(s);
  let m;
  NUMBERED.lastIndex = 0;
  while ((m = NUMBERED.exec(bare)) !== null) {
    const key = SYNONYM[m[1].toLowerCase()] || m[1].toLowerCase();
    out[key] = m[2];
  }
  return out;
}

/**
 * Inverse document frequency across the course's component titles.
 *
 * Without this, "Discussion 3 — Stress and health" scores as well as
 * "Discussion 2 — Racism as a determinant of health" on the Racism row, because
 * both share the common words "discussion" and "health". Rare words such as
 * "racism" are what actually identify a deliverable, so they must count for
 * more than words every title shares.
 */
export function buildIdf(components) {
  const n = Math.max(1, components.length);
  const df = new Map();
  for (const c of components) {
    for (const t of new Set(tokenise(c.title))) df.set(t, (df.get(t) || 0) + 1);
  }
  const idf = new Map();
  for (const [t, d] of df) idf.set(t, Math.log(1 + n / d));
  return idf;
}

const weightOf = (t, idf) => (idf?.get(t) ?? Math.log(2));

/**
 * Score how well a candidate's surrounding text matches a component title.
 * Returns 0..1.
 */
export function scoreMatch(componentTitle, snippet, componentWeight, idf) {
  const titleTokens = tokenise(componentTitle);
  if (!titleTokens.length) return 0;

  const bare = stripDates(snippet);
  const snipTokens = new Set(tokenise(bare));
  if (!snipTokens.size) return 0;

  // A numbered component only matches text that agrees about the number.
  // "Part 1" against a row saying "Part 2" is disqualifying; a row that names
  // no part at all is merely uninformative, not contradictory.
  const titleNums = numberedPhrases(componentTitle);
  const snipNums = numberedPhrases(snippet);
  for (const [key, val] of Object.entries(titleNums)) {
    if (snipNums[key] !== undefined && snipNums[key] !== val) return 0;
  }

  let hit = 0;
  let all = 0;
  for (const t of new Set(titleTokens)) {
    const w = weightOf(t, idf);
    all += w;
    if (snipTokens.has(t)) hit += w;
  }
  if (!all) return 0;
  let score = hit / all;

  // An exact numbered agreement is strong corroboration.
  for (const [key, val] of Object.entries(titleNums)) {
    if (snipNums[key] === val) score = Math.min(1, score + 0.2);
  }

  // A matching weight in the same row corroborates too, but only mildly —
  // several deliverables in a course often share a weight.
  if (componentWeight > 0) {
    const w = Number(componentWeight);
    const pattern = new RegExp(`\\b${w % 1 ? w.toFixed(1) : w}\\s*%`);
    if (pattern.test(snippet)) score = Math.min(1, score + 0.12);
  }

  return score;
}

/**
 * Pick the best component for a candidate, or null.
 *
 * @param candidate  { snippet, date }
 * @param components components of the SAME course only
 * @param minScore   floor below which we refuse to guess
 */
export function matchComponent(candidate, components, minScore = 0.55) {
  const idf = buildIdf(components);

  let best = null;
  let bestScore = 0;
  let runnerUp = 0;

  for (const c of components) {
    const s = scoreMatch(c.title, candidate.snippet, c.weight, idf);
    if (s > bestScore) {
      runnerUp = bestScore;
      bestScore = s;
      best = c;
    } else if (s > runnerUp) {
      runnerUp = s;
    }
  }

  if (!best || bestScore < minScore) {
    return { component: null, score: bestScore, ambiguous: false };
  }

  // Two components fitting equally well means we cannot tell them apart, and
  // guessing would attach a date to the wrong deliverable.
  if (runnerUp > 0 && bestScore - runnerUp < 0.12) {
    return { component: null, score: bestScore, ambiguous: true };
  }

  return { component: best, score: bestScore, ambiguous: false };
}
