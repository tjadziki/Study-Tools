// Derivation layer — the port of the design canvas's renderVals().
//
// Pure: (serverState, nowMs) -> view model. No I/O, no handlers. The numbers
// and the display strings are identical to the mockup's; only the field names
// moved (due -> dueDate, est -> estHours, course -> courseId).

import { d, iso, today, fmt, fmtShort, daysTo, shift, fridays, hm } from './dates.js';
import { planWeek, rankTasks, rankOptions, TIER, TIER_LABEL } from './plan.js';
import { examForecast, busyWeeks, daysBetween } from './forecast.js';

// The term-long plan simulation behind the forecast is the one expensive thing
// derive() does, and derive() runs once a second off the clock. Cache it per
// state object (a mutation always produces a new one) and per calendar day.
const SIM_CACHE = new WeakMap();
function cached(state, key, compute) {
  const hit = SIM_CACHE.get(state);
  if (hit && hit.key === key) return hit.value;
  const value = compute();
  SIM_CACHE.set(state, { key, value });
  return value;
}

/* ── the triage priority score ──────────────────────────────────────────────
   (weight/estHours x 10) + (1/max(daysUntilDue,1) x 30) + (droppable ? -5 : 0)
   Unchanged from the design file, and still what orders every task that has
   room to breathe. It is no longer the whole ranking: its urgency term caps
   at 30, so on its own it ranks a cheap task due in a month above real work
   due tomorrow. Close deadlines are ranked by slack instead — see rankTasks
   in plan.js. The reasoning is surfaced on every card so the ranking can
   always be argued with.
   ───────────────────────────────────────────────────────────────────────── */
export function score(t, now) {
  const est = Math.max(0.25, Number(t.estHours) || 1);
  const w = Number(t.weight) || 0;
  const mph = w / est;
  const dd = daysTo(t.dueDate, now);
  const days = dd == null ? 999 : dd;
  const urgency = 1 / Math.max(days, 1);
  return { mph, days, priority: mph * 10 + urgency * 30 + (t.droppable ? -5 : 0) };
}

export function reasonLine(t) {
  const when =
    t.days === 999
      ? 'no due date set'
      : t.days < 0
        ? `${-t.days} days overdue`
        : t.days === 0
          ? 'due today'
          : t.days === 1
            ? 'due tomorrow'
            : `due in ${t.days} days`;
  // An urgent task is ranked by its deadline, not its marks per hour, so the
  // line says so — otherwise a 30.0 sitting above a 62.7 looks like a bug.
  if (t.tier === 0 && t.slack != null) {
    const est = `${Number(t.estHours)} h of work`;
    const slack =
      t.days < 0
        ? 'overdue — submit or mark it done'
        : t.slack <= 0
          ? 'no slack left — ranked by deadline'
          : `${slackStr(t.slack)} of slack — ranked by deadline`;
    return `${est} · ${when} · ${slack}`;
  }
  return `${t.mph.toFixed(1)} marks/hour · ${when} · ${t.droppable ? 'droppable' : 'cannot be dropped'}`;
}

/** 1.5 -> "1.5 days", 1 -> "1 day", -2 -> "-2 days" */
export function slackStr(slack) {
  const r = Math.round(slack * 10) / 10;
  return `${r} day${Math.abs(r) === 1 ? '' : 's'}`;
}

const TAPER = [
  { k: 14, label: 'T-14', what: 'Final practice block. The error log must be complete by now.' },
  { k: 7, label: 'T-7', what: 'Full closed-book past paper, under time pressure.' },
  { k: 3, label: 'T-3', what: 'Error log — top third by frequency only.' },
  { k: 1, label: 'T-1', what: '2–4 hours maximum. Error log only. Hard stop at 21:00.' },
  { k: 0, label: 'NIGHT BEFORE', what: '8 hours of sleep. Non-negotiable — it is worth more than the fifth hour.' },
];

export const LADDER = [
  {
    step: 'RUNG 01',
    title: 'Worked example',
    body: 'Open the textbook to a solved problem of the same type. Work it forward, then cover the solution and redo it unaided.',
  },
  {
    step: 'RUNG 02',
    title: 'A different explanation',
    body: 'LEARN videos, last term’s notes, a second textbook. Same concept, different voice — not the same page again.',
  },
  { step: 'RUNG 03', title: 'A human, inside 48 hours', body: '' },
];

const pct = (n) => `${Math.round(n * 100)}%`;
const weightStr = (w) => `${Number(w) % 1 ? Number(w).toFixed(1) : String(Number(w))}%`;

export function derive(state, now) {
  const { courses, components: rawComponents, errors, concepts, sessions, termWeeks, conflicts, settings } = state;

  // A date nobody has confirmed is not a date. Scanned proposals are kept on
  // the row as `proposedDate` so the review queue can show them, but they are
  // invisible to the triage ranking, the horizon and the exam taper until the
  // user confirms them. This is what keeps a parser's guess from quietly
  // reordering the queue.
  const components = rawComponents.map((c) => ({
    ...c,
    proposedDate: c.dueDate,
    dueDate: c.userConfirmed ? c.dueDate : null,
  }));

  const minErr = Number(settings.minErrorsAtT14 ?? 15);
  const minPerErr = Number(settings.minutesPerErrorReview ?? 5.5);
  const horizon = Number(settings.examHorizonDays ?? 21);
  const termStart = settings.termStart || '2026-09-09';
  const termEnd = settings.termEnd || '2026-12-08';

  const byId = Object.fromEntries(courses.map((c) => [c.id, c]));
  const code = (id) => byId[id]?.code || id;
  const examCourses = courses.filter((c) => c.examCourse);

  const tdy = today(now);
  const start = d(termStart);
  const end = d(termEnd);
  const dayTotal = Math.round((end - start) / 86400000) + 1;
  const dayIdx = Math.min(Math.max(1, Math.round((tdy - start) / 86400000) + 1), dayTotal);
  const lectureWeeks = termWeeks.filter((w) => !w.isReadingWeek).length || 13;
  const currentWeek = termWeeks.find((w) => iso(tdy) >= w.startDate && iso(tdy) <= w.endDate);
  const weekNo = currentWeek
    ? currentWeek.isReadingWeek
      ? 'RD'
      : String(currentWeek.weekNumber).padStart(2, '0')
    : String(Math.max(1, Math.ceil(dayIdx / 7))).padStart(2, '0');
  const termPct = Math.max(1, Math.min(100, Math.round((dayIdx / dayTotal) * 100)));

  /* ── triage ───────────────────────────────────────────────────────────── */
  // Candidates never reach this queue — they wait in the review queue until
  // they are confirmed. Rejected ones never come back.
  const live = components.filter((t) => t.status === 'todo' || t.status === 'done');
  const open = live.filter((t) => t.status !== 'done');
  const queue = open.filter(
    (t) => t.kind !== 'exam' || (t.dueDate != null && daysTo(t.dueDate, now) <= horizon)
  );
  const scored = rankTasks(
    queue.map((t) => ({ ...t, ...score(t, now) })),
    rankOptions(settings)
  );
  const maxP = scored.length ? Math.max(1, ...scored.map((t) => t.priority)) : 1;

  const vm = (t, i) => ({
    id: t.id,
    rank: String(i + 1).padStart(2, '0'),
    courseId: t.courseId,
    course: code(t.courseId),
    title: t.title,
    weightStr: weightStr(t.weight),
    estStr: `${t.estHours} h`,
    mphStr: t.mph.toFixed(1),
    dueStr: fmt(t.dueDate) + (t.dueDate && t.dateIsEstimate ? ' (est.)' : ''),
    daysStr:
      t.days === 999
        ? 'no date'
        : t.days < 0
          ? `${-t.days} d overdue`
          : t.days === 0
            ? 'today'
            : `in ${t.days} d`,
    priorityStr: t.priority.toFixed(1),
    // The number that actually decided the rank. For an urgent task that is
    // its slack, not its priority score — showing the score there would put a
    // 30.0 above a 62.7 with no visible reason.
    rankLabel: t.tier === TIER.URGENT ? 'SLACK' : 'PRIORITY',
    rankStr: t.tier === TIER.URGENT ? (t.days < 0 ? 'late' : `${(Math.round(t.slack * 10) / 10).toFixed(1)} d`) : t.priority.toFixed(1),
    tier: t.tier,
    tierLabel: TIER_LABEL[t.tier],
    reason: reasonLine(t),
    isTrap: !!t.trap,
    isFree: !!(t.free || (t.droppable && t.mph >= 4)),
    isExam: t.kind === 'exam',
    unconfirmed: !!t.dueDate && !t.userConfirmed,
    note: t.note || '',
    hasNote: !!t.note,
    barPct: Math.max(4, Math.round((t.priority / maxP) * 100)),
  });

  const rows = scored.map(vm);
  const doneTasks = live
    .filter((t) => t.status === 'done')
    .map((t) => ({ id: t.id, course: code(t.courseId), title: t.title, weightStr: weightStr(t.weight) }));

  /* ── at stake ─────────────────────────────────────────────────────────── */
  const stake = courses.map((c) => {
    const items = live.filter((t) => t.courseId === c.id);
    const total = items.reduce((a, t) => a + (Number(t.weight) || 0), 0);
    const banked = items
      .filter((t) => t.status === 'done')
      .reduce((a, t) => a + (Number(t.weight) || 0), 0);
    const p = total ? banked / total : 0;
    return {
      id: c.id,
      code: c.code,
      tbd: !c.weightsKnown,
      pct: p,
      total,
      label: total ? `${pct(p)} banked` : 'no weights entered',
      pctNum: Math.round(p * 100),
    };
  });
  const withWeights = stake.filter((s) => s.total > 0);
  const unbanked = withWeights.length
    ? Math.round((withWeights.reduce((a, s) => a + (1 - s.pct), 0) / withWeights.length) * 100)
    : 0;

  /* ── horizon ──────────────────────────────────────────────────────────── */
  const horizonList = live
    .filter((t) => t.kind === 'exam' && t.status !== 'done' && t.dueDate)
    .map((t) => ({ ...t, days: daysTo(t.dueDate, now) }))
    .filter((t) => t.days >= 0)
    .sort((a, b) => a.days - b.days)
    .slice(0, 3)
    .map((t) => ({
      course: code(t.courseId),
      name: t.title,
      weightStr: `${t.weight}%`,
      dateStr: fmtShort(t.dueDate) + (t.dateIsEstimate ? ' est.' : ''),
      daysStr: `T-${t.days}`,
    }));

  /* ── open concepts ────────────────────────────────────────────────────── */
  const ageOf = (c) => Math.floor((now - Date.parse(c.openedAt)) / 86400000);
  const openConcepts = concepts.filter((c) => c.status === 'open');
  const conceptList = openConcepts.map((c) => {
    const age = ageOf(c);
    return {
      id: c.id,
      courseId: c.courseId,
      course: code(c.courseId),
      text: c.description,
      ageStr: `${age}d open`,
      stale: age >= 7,
      fresh: age < 7,
      rungs: c.rungs,
      openedAt: c.openedAt,
    };
  });
  const stale = conceptList.filter((c) => c.stale);

  /* ── practice blocks ──────────────────────────────────────────────────── */
  const fris = fridays(termStart, termEnd);
  const blockSet = new Set(
    sessions.filter((s) => s.type === 'practice').map((s) => `${s.date}|${s.courseId}`)
  );
  const plannedSet = new Set(
    sessions.filter((s) => s.type === 'planned').map((s) => `${s.date}|${s.courseId}`)
  );
  const isDone = (f, cid) => blockSet.has(`${f}|${cid}`);

  const pastFridays = fris.filter((f) => d(f) <= tdy);
  let streak = 0;
  for (let i = pastFridays.length - 1; i >= 0; i--) {
    if (examCourses.every((c) => isDone(pastFridays[i], c.id))) streak++;
    else break;
  }
  const upcoming = fris.find((f) => d(f) >= tdy) || fris[fris.length - 1];

  const errorsFor = (cid) => errors.filter((e) => e.courseId === cid);

  const weekBlocks = examCourses.map((c) => ({
    courseId: c.id,
    course: c.code,
    date: upcoming,
    done: isDone(upcoming, c.id),
    errStr: `${errorsFor(c.id).length} banked`,
  }));
  const fridayRows = fris.map((f) => ({
    date: f,
    label: fmtShort(f),
    cells: examCourses.map((c) => ({ courseId: c.id, date: f, done: isDone(f, c.id) })),
  }));

  /* ── error bank ───────────────────────────────────────────────────────── */
  const bankRows = examCourses.map((c) => {
    const n = errorsFor(c.id).length;
    return {
      id: c.id,
      course: c.code,
      countStr: String(n),
      summary: n ? `est. ${hm(n * minPerErr)} of review` : 'nothing banked yet',
      readyStr: n >= minErr ? 'exam-ready' : `${n}/${minErr}`,
    };
  });

  const bankFor = (cid) => {
    const entries = errorsFor(cid);
    const groupMap = {};
    entries.forEach((e) => {
      (groupMap[e.topic] = groupMap[e.topic] || []).push(e);
    });
    const topicGroups = Object.keys(groupMap)
      .map((k) => ({ topic: k, entries: groupMap[k] }))
      .sort((a, b) => b.entries.length - a.entries.length)
      .map((g) => ({
        topic: g.topic,
        countStr: String(g.entries.length),
        entries: g.entries
          .slice()
          // Newest first, with id as a tiebreaker so equal dates keep a
          // fixed order across the once-a-second re-derive.
          .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(a.id).localeCompare(String(b.id)))
          .map((e) => ({ id: e.id, dateStr: fmtShort(e.date), what: e.whatIGotWrong })),
      }));
    return {
      topicGroups,
      counterStr: `${code(cid)} error log: ${entries.length} entries · est. ${hm(
        Math.max(1, entries.length * minPerErr)
      )} review`,
    };
  };

  /* ── exam taper ───────────────────────────────────────────────────────── */
  const remainingBlocks = (dueIso) =>
    fris.filter((f) => d(f) > tdy && d(f) <= d(shift(dueIso, -14))).length;

  const examRows = live
    .filter((t) => t.kind === 'exam' && t.dueDate)
    .map((t) => ({ ...t, days: daysTo(t.dueDate, now) }))
    .sort((a, b) => a.days - b.days)
    .map((t) => {
      const n = errorsFor(t.courseId).length;
      const tracked = !!byId[t.courseId]?.examCourse;
      const blocksLeft = remainingBlocks(t.dueDate);
      const need = Math.max(0, minErr - n);
      return {
        id: t.id,
        course: code(t.courseId),
        name: t.title,
        weightStr: `${t.weight || 0}%`,
        dateStr: fmt(t.dueDate) + (t.dateIsEstimate ? ' · est., confirm on LEARN' : ''),
        daysStr: t.days < 0 ? 'written' : `${t.days}d`,
        bankStr: tracked ? String(n) : '—',
        warn: tracked && t.days >= 0 && t.days <= 14 && n < minErr,
        projection: tracked && t.days > 14 && need > 0 && blocksLeft > 0,
        projectionStr:
          tracked && blocksLeft > 0
            ? `${need} more entries to clear the floor of ${minErr} by T-14 · ${blocksLeft} practice blocks left before then = ${Math.ceil(
                need / blocksLeft
              )} per block`
            : '',
        steps: TAPER.map((st) => {
          const dt = shift(t.dueDate, -st.k);
          const past = d(dt) < tdy;
          return { label: st.label, what: st.what, dateStr: fmtShort(dt), past, ahead: !past };
        }),
      };
    });

  // Exams with no confirmed date cannot be back-planned at all.
  const undatedExams = live
    .filter((t) => t.kind === 'exam' && !t.dueDate)
    .map((t) => ({ id: t.id, course: code(t.courseId), name: t.title, weightStr: `${t.weight}%` }));

  /* ── weekly review ────────────────────────────────────────────────────── */
  const reviews = sessions
    .filter((s) => s.type === 'review')
    .sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  const lastReview = reviews.length ? reviews[reviews.length - 1] : null;
  let rStreak = 0;
  for (let i = reviews.length - 1; i >= 0; i--) {
    if (i === reviews.length - 1) {
      if ((tdy - d(reviews[i].date)) / 86400000 <= 9) rStreak = 1;
      else break;
    } else {
      const gap = (d(reviews[i + 1].date) - d(reviews[i].date)) / 86400000;
      if (gap <= 9) rStreak++;
      else break;
    }
  }
  const nextSunday = (() => {
    const dt = new Date(tdy);
    const add = (7 - dt.getDay()) % 7;
    dt.setDate(dt.getDate() + add);
    return iso(dt);
  })();
  const nextFriday = fris.find((f) => d(f) > tdy) || upcoming;
  const nextBlocks = examCourses.map((c) => ({
    courseId: c.id,
    course: c.code,
    date: nextFriday,
    done: plannedSet.has(`${nextFriday}|${c.id}`),
  }));

  /* ── review queue ─────────────────────────────────────────────────────── */
  // Three kinds of thing need a human decision: a proposed date for a known
  // deliverable, a proposed brand-new deliverable, and a conflict with a date
  // already confirmed.
  const fileName = (p) => (p ? String(p).split(/[\\/]/).pop() : null);
  const asReview = (t, sort) => ({
    id: t.id,
    kind: sort,
    course: code(t.courseId),
    courseId: t.courseId,
    title: t.title,
    weight: t.weight,
    weightStr: weightStr(t.weight),
    proposedDate: t.proposedDate,
    proposedStr: fmt(t.proposedDate),
    confidence: t.confidence,
    sourceFile: fileName(t.sourceFile),
    sourceFileFull: t.sourceFile,
    sourceSnippet: t.sourceSnippet || '',
    isExam: t.kind === 'exam',
  });

  const proposedDates = components
    .filter((t) => (t.status === 'todo' || t.status === 'done') && t.proposedDate && !t.userConfirmed)
    .map((t) => asReview(t, 'date'));

  const proposedItems = components
    .filter((t) => t.status === 'candidate')
    .map((t) => asReview(t, 'item'));

  const conflictRows = conflicts.map((c) => ({
    id: c.id,
    kind: 'conflict',
    course: code(c.courseId),
    title: c.componentTitle,
    componentId: c.componentId,
    proposedDate: c.proposedDate,
    proposedStr: fmt(c.proposedDate),
    currentDate: c.currentDate,
    currentStr: fmt(c.currentDate),
    confidence: c.confidence,
    sourceFile: fileName(c.sourceFile),
    sourceSnippet: c.sourceSnippet || '',
  }));

  const CONF_ORDER = { high: 0, medium: 1, low: 2 };
  const reviewQueue = [
    ...conflictRows,
    ...[...proposedDates, ...proposedItems].sort(
      (a, b) =>
        CONF_ORDER[a.confidence] - CONF_ORDER[b.confidence] ||
        String(a.proposedDate).localeCompare(String(b.proposedDate))
    ),
  ];

  const candidates = proposedItems;
  const unconfirmedDated = proposedDates.length;

  // Config edits the raw rows, not the queue: exams beyond the horizon and
  // undated items must stay reachable.
  const configRows = live
    .slice()
    // A total order, with id as the final tiebreaker.
    //
    // This must never return a nonzero value for two equal rows. derive() runs
    // once a second off the clock tick, and an inconsistent comparator re-sorts
    // equal items into a different permutation every time — which reorders the
    // table rows under the user, moves the DOM nodes, and slams shut any date
    // picker they have open.
    .sort(
      (a, b) =>
        (byId[a.courseId]?.sortOrder ?? 99) - (byId[b.courseId]?.sortOrder ?? 99) ||
        String(a.dueDate ?? '9999').localeCompare(String(b.dueDate ?? '9999')) ||
        String(a.title).localeCompare(String(b.title)) ||
        String(a.id).localeCompare(String(b.id))
    )
    .map((t) => ({
      id: t.id,
      course: code(t.courseId),
      title: t.title,
      isExam: t.kind === 'exam',
      weight: t.weight,
      estHours: t.estHours,
      dueDate: t.dueDate,
      confidence: t.confidence,
      sourceFile: t.sourceFile,
      userConfirmed: t.userConfirmed,
      status: t.status,
    }));

  /* ── the daily plan ───────────────────────────────────────────────────────
     Derived, never stored. It reads the same `scored` list the triage view
     ranks, so the plan cannot recommend something the triage list disagrees
     with, and a date confirmed in the review queue reshapes tomorrow with no
     further action. Only the ticks are persisted.
     ─────────────────────────────────────────────────────────────────────── */
  const materialsByCourse = {};
  for (const m of state.materials || []) {
    (materialsByCourse[m.courseId] = materialsByCourse[m.courseId] || []).push(m);
  }

  const doneByDate = {};
  for (const r of state.planLog || []) {
    (doneByDate[r.date] = doneByDate[r.date] || new Set()).add(r.slotKey);
  }

  const errorCounts = Object.fromEntries(courses.map((c) => [c.id, errorsFor(c.id).length]));

  // What the plan would see on any given day: deadlines measured from that
  // day, exams admitted at their own T-horizon, and anything due before a
  // future day assumed handed in by then.
  const todayIso = iso(tdy);
  const poolFor = (dateIso) => {
    const at = d(dateIso).getTime();
    const future = dateIso > todayIso;
    return open
      .filter((t) => !(future && t.dueDate && t.dueDate < dateIso))
      .filter((t) => t.kind !== 'exam' || (t.dueDate != null && daysTo(t.dueDate, at) <= horizon))
      .map((t) => ({ ...t, ...score(t, at) }));
  };

  // Hours already worked, from the plan log. Work from before today is taken
  // off each task's estimate so the plan does not schedule it twice; today's
  // ticks are left out because today's blocks are still on the plan.
  const spentBefore = {};
  const workedByTask = {};
  for (const w of state.taskWork || []) {
    spentBefore[w.taskId] = w.before;
    workedByTask[w.taskId] = w.total;
  }

  const nowDate = new Date(now);
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes();

  const planArgs = {
    date: todayIso,
    nowMin,
    scored,
    poolFor,
    spent: spentBefore,
    classBlocks: state.classBlocks || [],
    settings,
    materialsByCourse,
    code,
    examCourses,
    errorCounts,
    staleConcepts: stale.map((c) => ({ courseId: c.courseId, text: c.text })),
    // ME 597 has neither weights nor dates posted. Reading is the only thing
    // that banks value there, so the planner is told about it explicitly.
    unknownCourses: courses.filter((c) => !c.weightsKnown),
    doneKeysFor: (dt) => doneByDate[dt] || new Set(),
  };

  const dueOn = (dateIso) =>
    open
      .filter((t) => t.dueDate === dateIso)
      .map((t) => ({ course: code(t.courseId), title: t.title, weightStr: weightStr(t.weight) }));

  // One simulation serves both the week strip and the exam forecast: from
  // today to the day after the last dated exam (at least a week, at most a
  // term).
  const openExams = open.filter((t) => t.kind === 'exam');
  const lastExam = openExams.reduce((m, t) => (t.dueDate && t.dueDate > m ? t.dueDate : m), todayIso);
  const simDays = Math.min(120, Math.max(7, daysBetween(todayIso, lastExam) + 1));
  // Missed blocks change the plan as the day goes on, so the cache turns over
  // every quarter hour — often enough to notice, rarely enough to be free.
  const simulation = cached(state, `${todayIso}|${simDays}|${Math.floor(nowMin / 15)}`, () =>
    planWeek(planArgs, simDays)
  );

  const forecast = examForecast({
    exams: openExams.map((t) => ({ ...t, course: code(t.courseId) })),
    planDays: simulation,
    workedByTask,
    todayIso,
    errorCounts,
    minErr,
  });

  const outlook = busyWeeks({
    tasks: components
      .filter((t) => t.status === 'todo')
      .map((t) => ({ ...t, course: code(t.courseId) })),
    todayIso,
    endIso: termEnd,
    workedByTask,
    dailyTargetH: Number(settings.dailyTargetHours ?? 4),
    weekendTargetH: Number(settings.weekendTargetHours ?? 4),
    hoursPerDay: rankOptions(settings).hoursPerDay,
  });

  const weekPlan = simulation.slice(0, 7).map((day, i) => {
    const dt = d(day.date);
    return {
      ...day,
      isToday: i === 0,
      dayName: dt.toLocaleDateString('en-CA', { weekday: 'short' }),
      dayNum: String(dt.getDate()),
      label: fmtShort(day.date),
      capacityStr: hm(day.capacityMin),
      committedStr: hm(day.committedMin),
      targetStr: hm(day.targetMin),
      doneStr: hm(day.doneMin),
      classCount: day.classes.length,
      due: dueOn(day.date),
      focus: day.slots.find((s) => !s.spare && s.tag !== 'spare') || day.slots[0] || null,
    };
  });
  const todayPlan = weekPlan[0];

  return {
    header: {
      dayStr: `${String(dayIdx).padStart(2, '0')}/${dayTotal}`,
      weekStr: `${weekNo}/${lectureWeeks}`,
      unbankedStr: `${unbanked}%`,
      errorTotalStr: String(errors.length),
      practiceStreakStr: `${streak}w`,
      reviewStreakStr: `${rStreak}w`,
      termPct,
      weekNo,
      lectureWeeks,
      termLabel: `FALL 2026 · 4A MECHANICAL · ${fmtShort(termStart).toUpperCase()} — ${fmtShort(termEnd).toUpperCase()}`,
      openConceptCount: openConcepts.length,
    },
    rules: { minErr, minPerErr, horizon, termStart, termEnd },
    courses,
    examCourses,
    byId,
    code,
    triage: {
      top: rows[0] || null,
      rest: rows.slice(1),
      rows,
      doneTasks,
      doneCountStr: `${doneTasks.length} items banked`,
    },
    stake,
    horizonList,
    conceptList,
    stale,
    conceptCountStr: `${conceptList.length} open · ${stale.length} stale`,
    staleCountStr: stale.length ? `${stale.length} waiting` : 'none right now',
    weekBlocks,
    weekBlockDateStr: fmtShort(upcoming),
    fridayRows,
    blocksLoggedStr: String(blockSet.size),
    bankRows,
    bankFor,
    examRows,
    undatedExams,
    reviews: reviews.slice().reverse().map((r) => ({
      dateStr: fmtShort(r.date),
      text: r.note || '(no reflection written)',
    })),
    lastReviewStr: lastReview ? fmtShort(lastReview.date) : 'never',
    nextReviewStr: fmtShort(nextSunday),
    nextSunday,
    nextBlocks,
    nextFridayStr: fmtShort(nextFriday),
    blindSpots: courses.filter(
      (c) => !c.weightsKnown && !live.some((t) => t.courseId === c.id)
    ),
    today: todayPlan,
    weekPlan,
    forecast,
    outlook,
    classBlocks: state.classBlocks || [],
    materialsByCourse,
    candidates,
    conflicts,
    conflictRows,
    reviewQueue,
    unconfirmedDated,
    configRows,
    termWeeks,
    settings,
  };
}
