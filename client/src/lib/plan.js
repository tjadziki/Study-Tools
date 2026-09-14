// The daily planner.
//
// Pure: (deck facts, a date) -> a list of time-stamped study slots. No I/O, no
// clock of its own. Nothing here is stored: confirm a date, tick an item off,
// move a class, and the next render is already the new plan. The only thing
// persisted is which slots were actually worked (planLog), because that is a
// fact about the past rather than a guess about the future.
//
// The shape of a day:
//
//   study window  --------------------------------------------------------
//   classes       ######          #########
//   free          ------    ------         -----------------------------
//   slots         [  A  ]   [  B ]         [  C  ] [  D  ] [ spare ]
//
// Slots are filled highest-priority-first from the same triage score the rest
// of the deck uses, so the plan can never disagree with the triage list.

import { d, iso } from './dates.js';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** 450 -> "07:30" */
export function hhmm(min) {
  const m = clamp(Math.round(min), 0, 24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Merge overlapping or touching [start, end] ranges. */
export function mergeRanges(ranges) {
  const sorted = ranges
    .filter((r) => r[1] > r[0])
    .map((r) => [r[0], r[1]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push(r);
  }
  return out;
}

/** The study window minus the classes, each already padded by a travel buffer. */
export function freeWindows(busy, dayStart, dayEnd) {
  const blocked = mergeRanges(
    busy.map((b) => [Math.max(b[0], dayStart), Math.min(b[1], dayEnd)])
  );
  const out = [];
  let cursor = dayStart;
  for (const [s, e] of blocked) {
    if (s > cursor) out.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) out.push([cursor, dayEnd]);
  return out;
}

/**
 * Cut a free window into equal study blocks separated by breaks.
 *
 * The count is the fewest blocks that keeps every block at or under maxBlock;
 * if that would drive them below minBlock the count comes back down, and a
 * window too short for even one block yields nothing. Equal lengths matter
 * more than maximal packing — a 96-minute block you will actually sit through
 * beats a 110 followed by a 46.
 */
export function splitWindow(start, end, { minBlock, maxBlock, breakMin }) {
  const total = end - start;
  if (total < minBlock) return [];
  let n = Math.max(1, Math.ceil((total + breakMin) / (maxBlock + breakMin)));
  while (n > 1 && (total - (n - 1) * breakMin) / n < minBlock) n -= 1;
  const each = Math.floor((total - (n - 1) * breakMin) / n);
  if (each < minBlock) return [];
  const out = [];
  let cursor = start;
  for (let i = 0; i < n; i += 1) {
    out.push([cursor, cursor + each]);
    cursor += each + breakMin;
  }
  return out;
}

/* ── what to actually do in a slot ───────────────────────────────────────── */

// Deliverables. The instruction is a function of how far out the deadline is,
// so the same task reads differently in week 1 and in the last 48 hours.
function workAction(days) {
  if (days == null || days === 999) return 'Scope it: read the brief and write down what is still unknown.';
  if (days < 0) return 'Overdue. Salvage whatever is still markable and submit it today.';
  if (days === 0) return 'Due today — finish it, check the submission format, submit.';
  if (days <= 2) return 'Final pass. Proof it and check the format; leave nothing to the last hour.';
  if (days <= 5) return 'Push it to a complete draft. A rough whole beats a polished half.';
  if (days <= 10) return 'Main build session. Hardest section first, while you are fresh.';
  if (days <= 18) return 'Work the core of it. Aim to have the shape of the answer by the end.';
  return 'Open it early: read the brief, list what you cannot yet do, fix one of those things.';
}

// Exams reuse the taper the Exam view already teaches, so the two screens can
// never contradict each other.
function examAction(days) {
  if (days == null || days === 999) return 'No date yet — bank error-log entries until there is one.';
  if (days > 14) return 'Steady practice. Every mistake goes in the error log, not in your head.';
  if (days > 7) return 'T-14 window: the last full practice block. The error log must be complete now.';
  if (days > 3) return 'T-7 window: a full past paper, closed book, under time.';
  if (days > 1) return 'T-3 window: error log only, top third by frequency.';
  if (days === 1) return 'T-1: two to four hours, error log only. Hard stop at 21:00.';
  if (days === 0) return 'Today. Read nothing new.';
  return 'Written.';
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'part', 'assignment', 'project', 'course',
  'final', 'draft', 'pdf', 'docx', 'pptx', 'html', 'copy', 'new', 'rev',
]);

/**
 * Meaningful words in a title or a filename.
 *
 * Numbers are kept whatever their length. "Behaviour Change Pt 1" and "Pt 2"
 * share every word they have, so without the digit the newer of the two
 * templates wins on a coin toss — and sends you to the wrong assignment.
 */
function tokens(s) {
  return String(s || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w) && (w.length >= 3 || /^\d+$/.test(w)));
}

/**
 * The file to open.
 *
 * A named match on the task wins outright. Failing that, a block whose whole
 * job is "read the newest thing" is happy with the newest thing of the right
 * kind — but a block for a specific deliverable is not: pointing at the wrong
 * brief is worse than pointing at nothing, in the same way a wrong deadline is
 * worse than no deadline. So `strict` blocks get a file only on a real match.
 */
function pickMaterial(list, wanted, title, strict = false) {
  if (!list || !list.length) return null;

  const want = new Set(tokens(title));
  if (want.size) {
    let best = null;
    let bestScore = 0;
    for (const m of list) {
      const score = tokens(m.name).filter((w) => want.has(w)).length;
      if (score > bestScore) {
        best = m;
        bestScore = score;
      }
    }
    if (bestScore >= 1) return best;
  }

  if (strict) return null;
  for (const kind of wanted) {
    const hit = list.find((m) => m.kind === kind);
    if (hit) return hit;
  }
  return list[0];
}

const WANTED = {
  deliverable: ['assignment', 'project', 'practice', 'lecture', 'material'],
  exam: ['exam', 'practice', 'solutions', 'lecture', 'material'],
  retrieval: ['practice', 'exam', 'solutions', 'assignment', 'lecture'],
  read: ['lecture', 'material', 'practice', 'outline'],
  consolidate: ['lecture', 'material', 'practice'],
  unblock: ['practice', 'lecture', 'material'],
};

// The block straight after a class, worded for what that class actually was.
// Writing up a project meeting and rewriting a lecture are not the same job.
const CONSOLIDATE = {
  LEC: {
    title: (c) => `Rewrite today's ${c} lecture notes`,
    action: 'Close the slides. Reconstruct the argument from memory, then open them and mark every gap.',
    why: 'straight after the lecture is the cheapest hour of study in the week',
  },
  LAB: {
    title: (c) => `Write up today's ${c} lab`,
    action: 'Results, what surprised you, and what you would do differently. While it is still in your hands.',
    why: 'lab detail evaporates overnight and the report is worth marks',
  },
  PRJ: {
    title: (c) => `Write up today's ${c} project meeting`,
    action: 'Decisions, who owns what, and the next deadline. Send it to the team before you close the laptop.',
    why: 'the meeting is only worth the record it leaves',
  },
  TUT: {
    title: (c) => `Redo today's ${c} tutorial problems`,
    action: 'Work them again unaided. Anything you cannot reproduce goes in the error log.',
    why: 'a tutorial you watched is not a tutorial you can do',
  },
};

const daysPhrase = (days) => {
  if (days == null || days === 999) return 'no confirmed date';
  if (days < 0) return `${-days} days overdue`;
  if (days === 0) return 'due today';
  if (days === 1) return 'due tomorrow';
  return `due in ${days} d`;
};

/* ── the plan ────────────────────────────────────────────────────────────── */

/**
 * One day's plan.
 *
 * `spent` carries minutes already allocated to a task earlier in the week, so
 * planWeek can retire a task once its estimate is used up instead of showing
 * the same job on all seven days. It is never mutated.
 */
export function planDay({
  date,
  scored = [],
  classBlocks = [],
  settings = {},
  doneKeys = new Set(),
  materialsByCourse = {},
  code = (x) => x,
  examCourses = [],
  errorCounts = {},
  staleConcepts = [],
  unknownCourses = [],
  spent = {},
}) {
  const num = (key, fallback) => {
    const v = Number(settings[key]);
    return Number.isFinite(v) ? v : fallback;
  };
  const dayStart = num('dayStartMin', 450);
  const dayEnd = num('dayEndMin', 1260);
  const minBlock = num('minBlockMinutes', 45);
  const maxBlock = num('maxBlockMinutes', 110);
  const breakMin = num('breakMinutes', 15);
  const buffer = num('classBufferMinutes', 15);
  const minErr = num('minErrorsAtT14', 15);

  const weekday = d(date).getDay();
  const weekend = weekday === 0 || weekday === 6;
  const targetMin = Math.round(60 * num(weekend ? 'weekendTargetHours' : 'dailyTargetHours', 4));

  const classes = classBlocks
    .filter((b) => b.weekday === weekday)
    .slice()
    .sort((a, b) => a.startMin - b.startMin || String(a.id).localeCompare(String(b.id)))
    .map((b) => ({
      ...b,
      course: code(b.courseId),
      timeStr: `${hhmm(b.startMin)} – ${hhmm(b.endMin)}`,
    }));

  const windows = freeWindows(
    classes.map((b) => [b.startMin - buffer, b.endMin + buffer]),
    dayStart,
    dayEnd
  );
  const raw = windows.flatMap(([s, e]) => splitWindow(s, e, { minBlock, maxBlock, breakMin }));
  const capacityMin = raw.reduce((a, [s, e]) => a + (e - s), 0);

  /* ── the work pool ────────────────────────────────────────────────────── */
  // Already in priority order; drop anything whose estimate is used up.
  const budget = { ...spent };
  const left = (t) => Math.max(0, Number(t.estHours || 1) * 60 - (budget[t.id] || 0));
  const pool = scored.filter((t) => left(t) > 0);

  // Marks per hour alone would hand today to whatever is cheapest, even when
  // it is due in two months: five 45-minute discussion posts score higher than
  // the project worth 18% of the course. So the day is built from work that is
  // actually near — due inside the horizon, or with no date yet, since undated
  // work is exactly what needs scoping early. Everything further out is a
  // pull-ahead, and only gets the blocks left over once the target is met.
  const horizon = num('planHorizonDays', 21);
  const isNear = (t) => t.days == null || t.days === 999 || t.days <= horizon;
  const near = pool.filter(isNear);
  const far = pool.filter((t) => !isNear(t));

  // A task gets at most two blocks a day, so one deliverable cannot swallow a
  // whole Friday — unless it is due inside 48 hours, when it should.
  const slotCap = (t) => (t.days != null && t.days !== 999 && t.days <= 2 ? 99 : 2);
  const taken = {};
  const available = (list) => list.find((x) => (taken[x.id] || 0) < slotCap(x) && left(x) > 0);

  /* ── maintenance ──────────────────────────────────────────────────────── */
  // What to do when nothing is due. This is the answer to "I have four hours
  // and no assignment this week" — the work no deadline will ever force.
  const maintenance = [];
  for (const c of staleConcepts) {
    maintenance.push({
      tag: 'unblock',
      courseId: c.courseId,
      title: `Unblock: ${c.text}`,
      action: 'Open over a week. Rung 1, then rung 2, then email a human — today.',
      why: 'an open block compounds: everything downstream of it is stuck too',
    });
  }
  for (const c of examCourses) {
    const n = errorCounts[c.id] || 0;
    maintenance.push({
      tag: 'retrieval',
      courseId: c.id,
      title: `${code(c.id)} retrieval practice`,
      action:
        n < minErr
          ? `Work problems unaided and log every miss. ${minErr - n} more entries clears the floor of ${minErr}.`
          : 'Redo the top third of the error log from memory. Closed book, then mark.',
      why: n < minErr ? `${n}/${minErr} errors banked` : `${n} errors banked — keep them warm`,
    });
  }
  for (const c of unknownCourses) {
    maintenance.push({
      tag: 'read',
      courseId: c.id,
      title: `${code(c.id)} — read the newest posted material`,
      action: 'Read it, then write three questions about it you cannot answer yet.',
      why: 'no weights and no dates posted yet, so reading is the only thing that banks value here',
    });
  }
  let mIdx = 0;
  const nextMaintenance = () => (maintenance.length ? maintenance[mIdx++ % maintenance.length] : null);

  /* ── the consolidation slot ───────────────────────────────────────────── */
  // The first block after a lecture belongs to that lecture. Notes rewritten
  // within the hour are worth several times the same hour a week later, and it
  // is the cheapest study in the week. One per day, and only on a day with
  // room for more than a couple of blocks.
  const consolidateAfter =
    raw.length >= 3
      ? classes
          .map((c) => ({ c, slot: raw.find(([s]) => s >= c.endMin && s <= c.endMin + 90) }))
          .filter((x) => x.slot)
          .pop()
      : null;

  /* ── fill ─────────────────────────────────────────────────────────────── */
  let planned = 0;
  const slots = raw.map(([s, e]) => {
    const minutes = e - s;
    const key = String(s);
    const base = {
      key,
      startMin: s,
      endMin: e,
      minutes,
      timeStr: `${hhmm(s)} – ${hhmm(e)}`,
      done: doneKeys.has(key),
      spare: planned >= targetMin,
    };
    planned += minutes;

    if (consolidateAfter && consolidateAfter.slot[0] === s) {
      const cid = consolidateAfter.c.courseId;
      const c = CONSOLIDATE[consolidateAfter.c.kind] || CONSOLIDATE.LEC;
      return {
        ...base,
        tag: 'consolidate',
        courseId: cid,
        course: code(cid),
        title: c.title(code(cid)),
        action: c.action,
        why: c.why,
        material: pickMaterial(materialsByCourse[cid], WANTED.consolidate, `${code(cid)} lecture`),
      };
    }

    // Near work first. Once that is exhausted, keeping the exam courses warm
    // beats starting something due in two months — but a block past the target
    // is exactly where getting ahead belongs, so there the far pile comes
    // first instead.
    const t = base.spare
      ? available(near) || available(far)
      : available(near);

    if (t) {
      taken[t.id] = (taken[t.id] || 0) + 1;
      const workMin = Math.min(minutes, left(t));
      budget[t.id] = (budget[t.id] || 0) + workMin;
      const isExam = t.kind === 'exam';
      return {
        ...base,
        tag: isExam ? 'exam' : 'deliverable',
        taskId: t.id,
        courseId: t.courseId,
        course: code(t.courseId),
        title: t.title,
        action: isExam ? examAction(t.days) : workAction(t.days),
        why:
          `${t.weight}% of the course · ${t.mph.toFixed(1)} marks/hour · ${daysPhrase(t.days)}` +
          // Saying so is the difference between finishing early and padding.
          (workMin < minutes - 10 ? ` · only ~${workMin} min of estimate left on this` : ''),
        material: pickMaterial(
          materialsByCourse[t.courseId],
          isExam ? WANTED.exam : WANTED.deliverable,
          t.title,
          !isExam
        ),
        trap: !!t.trap,
      };
    }

    const m = nextMaintenance();
    if (m) {
      return {
        ...base,
        tag: m.tag,
        courseId: m.courseId,
        course: code(m.courseId),
        title: m.title,
        action: m.action,
        why: m.why,
        material: pickMaterial(materialsByCourse[m.courseId], WANTED[m.tag] || WANTED.read, m.title),
      };
    }

    // Nothing near, nothing to maintain: pull something forward rather than
    // leave the block empty.
    const ahead = available(far);
    if (ahead) {
      taken[ahead.id] = (taken[ahead.id] || 0) + 1;
      budget[ahead.id] = (budget[ahead.id] || 0) + Math.min(minutes, left(ahead));
      return {
        ...base,
        tag: 'deliverable',
        taskId: ahead.id,
        courseId: ahead.courseId,
        course: code(ahead.courseId),
        title: ahead.title,
        action: workAction(ahead.days),
        why: `getting ahead · ${ahead.weight}% of the course · ${daysPhrase(ahead.days)}`,
        material: pickMaterial(materialsByCourse[ahead.courseId], WANTED.deliverable, ahead.title, true),
      };
    }

    return {
      ...base,
      tag: 'spare',
      title: 'Nothing is queued for this block',
      action: 'Rest, or get ahead on whatever is heaviest next week.',
      why: 'every deliverable in the deck is either done or out of estimate',
      spare: true,
    };
  });

  const doneMin = slots.filter((x) => x.done).reduce((a, x) => a + x.minutes, 0);
  const committedMin = slots.filter((x) => !x.spare).reduce((a, x) => a + x.minutes, 0);

  return {
    date,
    weekday,
    weekend,
    classes,
    slots,
    capacityMin,
    committedMin,
    targetMin,
    doneMin,
    metTarget: doneMin >= targetMin,
    shortOfCapacity: capacityMin < targetMin,
    spent: budget,
  };
}

/** Consecutive days, with each day's work retired from the next. */
export function planWeek(args, days = 7) {
  const out = [];
  let spent = args.spent || {};
  for (let i = 0; i < days; i += 1) {
    const dt = d(args.date);
    dt.setDate(dt.getDate() + i);
    const date = iso(dt);
    const day = planDay({
      ...args,
      date,
      spent,
      doneKeys: args.doneKeysFor ? args.doneKeysFor(date) : new Set(),
    });
    spent = day.spent;
    out.push(day);
  }
  return out;
}
