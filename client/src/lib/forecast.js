// Looking ahead: exam readiness and busy weeks.
//
// Pure, like plan.js. Both answer "what is going to hurt, and when do I have
// to start so that it doesn't?" — the question the daily plan cannot answer,
// because it only ever looks at today.

import { d, iso, fmtShort } from './dates.js';

const DAY_MS = 86400000;

export function addDays(dateIso, n) {
  const x = d(dateIso);
  x.setDate(x.getDate() + n);
  return iso(x);
}

export function daysBetween(fromIso, toIso) {
  return Math.round((d(toIso) - d(fromIso)) / DAY_MS);
}

/** The Monday on or before a date. */
export function mondayOf(dateIso) {
  const x = d(dateIso);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return iso(x);
}

const h1 = (min) => Math.round(min / 6) / 10; // minutes -> hours, 1 dp

/* ── 7. exam readiness ───────────────────────────────────────────────────────
   For every exam, walk the simulated plan from today up to the day before it
   and add up the prep it actually gets:

     committed  exam-prep blocks inside the daily target
     retrieval  retrieval blocks for that course, credited to its next exam
     spare      any of the above that fall beyond the daily target

   and set that against the hours still needed (the estimate, minus what the
   plan log says has already been worked). The verdict is one of:

     on track   committed prep covers what is left
     tight      it only fits if you work the beyond-target blocks too
     short      it does not fit at all — start before the plan would
     done       the estimate is already worked off
     undated    no confirmed date, so it cannot be forecast yet

   Because the plan is simulated day by day with the real ranking, two exams
   on the same day genuinely compete for the same blocks here, the way they
   will in practice.
   ────────────────────────────────────────────────────────────────────────── */

export function examForecast({
  exams = [],
  planDays = [],
  workedByTask = {},
  todayIso,
  errorCounts = {},
  minErr = 15,
}) {
  const dated = exams
    .filter((e) => e.dueDate && e.dueDate >= todayIso)
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || String(a.id).localeCompare(String(b.id)));

  const byId = Object.fromEntries(dated.map((e) => [e.id, e]));
  const acc = Object.fromEntries(
    dated.map((e) => [e.id, { committed: 0, retrieval: 0, spare: 0, first: null }])
  );
  const nextExamOf = (courseId, dateIso) =>
    dated.find((e) => e.courseId === courseId && e.dueDate > dateIso) || null;

  for (const day of planDays) {
    for (const s of day.slots || []) {
      if (s.done) continue;
      let exam = null;
      let kind = null;
      if (s.taskId && byId[s.taskId]) {
        exam = byId[s.taskId];
        kind = 'exam';
      } else if (s.tag === 'retrieval' && s.courseId) {
        exam = nextExamOf(s.courseId, day.date);
        kind = 'retrieval';
      }
      // The exam day itself is for writing it, not preparing for it.
      if (!exam || day.date >= exam.dueDate) continue;
      const a = acc[exam.id];
      if (s.spare) a.spare += s.minutes;
      else if (kind === 'exam') a.committed += s.minutes;
      else a.retrieval += s.minutes;
      if (!a.first) a.first = day.date;
    }
  }

  const rows = dated.map((e) => {
    const a = acc[e.id];
    const needMin = Math.round(Math.max(0.25, Number(e.estHours) || 0) * 60);
    const doneMin = Math.min(needMin, workedByTask[e.id] || 0);
    const leftMin = Math.max(0, needMin - doneMin);
    const coveredMin = a.committed + a.retrieval;
    const slackMin = 15; // a quarter hour either way is noise, not a verdict

    let status;
    if (leftMin <= 0) status = 'done';
    else if (coveredMin >= leftMin - slackMin) status = 'on-track';
    else if (coveredMin + a.spare >= leftMin - slackMin) status = 'tight';
    else status = 'short';

    const shortMin = Math.max(0, leftMin - coveredMin);
    // Retrieval practice counts toward an exam on top of its dedicated prep,
    // so "covered" can exceed "needed". Past 100% the surplus is not news.
    const shownMin = Math.min(coveredMin, leftMin);
    const daysLeft = daysBetween(todayIso, e.dueDate);
    const errors = errorCounts[e.courseId] || 0;
    const sameWeek = dated.filter(
      (o) => o.id !== e.id && Math.abs(daysBetween(o.dueDate, e.dueDate)) <= 2
    );

    return {
      id: e.id,
      courseId: e.courseId,
      course: e.course,
      title: e.title,
      weight: e.weight,
      dueDate: e.dueDate,
      dateStr: fmtShort(e.dueDate),
      daysLeft,
      needH: h1(needMin),
      doneH: h1(doneMin),
      leftH: h1(leftMin),
      plannedH: h1(shownMin),
      prepH: h1(a.committed),
      retrievalH: h1(a.retrieval),
      coveragePct: leftMin ? Math.min(100, Math.round((coveredMin / leftMin) * 100)) : 100,
      spareH: h1(a.spare),
      shortH: h1(shortMin),
      firstPrep: a.first,
      firstPrepStr: a.first ? fmtShort(a.first) : null,
      status,
      errors,
      errorFloor: minErr,
      errorsShort: Math.max(0, minErr - errors),
      clashes: sameWeek.map((o) => ({
        course: o.course,
        title: o.title,
        sameDay: o.dueDate === e.dueDate,
        dateStr: fmtShort(o.dueDate),
      })),
      verdict: verdict({ status, leftMin, coveredMin, spareMin: a.spare, shortMin, first: a.first, e }),
    };
  });

  const undated = exams
    .filter((e) => !e.dueDate)
    .map((e) => ({
      id: e.id,
      courseId: e.courseId,
      course: e.course,
      title: e.title,
      weight: e.weight,
      needH: h1(Math.round((Number(e.estHours) || 0) * 60)),
      status: 'undated',
      verdict: 'No confirmed date, so it cannot be planned for yet. Enter it the day the exam schedule is out.',
    }));

  return { rows, undated };
}

function verdict({ status, leftMin, coveredMin, spareMin, shortMin, first, e }) {
  const left = h1(leftMin);
  const got = h1(Math.min(coveredMin, leftMin));
  const from = first ? ` from ${fmtShort(first)}` : '';
  switch (status) {
    case 'done':
      return 'Prep estimate worked off. Keep the error log warm until the day.';
    case 'on-track':
      return `All ${left} h of prep fits inside your daily target${from}.`;
    case 'tight':
      return got > 0
        ? `Only ${got} h fits inside your daily target${from}. The other ${h1(shortMin)} h needs beyond-target blocks — work them.`
        : `None of its ${left} h fits inside your daily target — busier work takes every committed block. It only gets beyond-target blocks${from}, so work them.`;
    default:
      return `${got} h of ${left} h fits before ${fmtShort(e.dueDate)}, even counting beyond-target blocks${
        spareMin ? ` (${h1(spareMin)} h)` : ''
      }. Start prep now rather than waiting for the plan to bring it in.`;
  }
}

/* ── 8. busy weeks ───────────────────────────────────────────────────────────
   Deadlines cluster. The plan spreads work out day by day, but it cannot warn
   you that four things land in the same week unless something looks at the
   weeks as a whole. This does.

   For each Monday–Sunday week from now to the end of term, add up the hours
   of work still left on everything due that week and compare it with the
   hours you plan to study in a week. Then:

     heavy   the week's deadlines need 75% of a week's study time or more, or
             two exams land in it, or three items worth 10%+ each
     busy    40% or more, or two items worth 10%+ each
     normal  everything else

   A heavy or busy week gets a start-by date: the Monday you must start the
   week's work to finish it at your daily target — which is usually well
   before the week itself begins.
   ────────────────────────────────────────────────────────────────────────── */

export function busyWeeks({
  tasks = [],
  todayIso,
  endIso,
  workedByTask = {},
  dailyTargetH = 4,
  weekendTargetH = 4,
  hoursPerDay = 2,
  heavyRatio = 0.75,
  busyRatio = 0.4,
}) {
  const capacityH = dailyTargetH * 5 + weekendTargetH * 2;
  const leftH = (t) =>
    Math.max(0, (Number(t.estHours) || 0) * 60 - (workedByTask[t.id] || 0)) / 60;

  const lastDue = tasks.reduce(
    (m, t) => (t.dueDate && t.dueDate > m ? t.dueDate : m),
    endIso || todayIso
  );
  // The exam period runs about two weeks past the last lecture. A deadline
  // after that is almost always a slip — a mis-set date picker, a typo'd
  // month — and a wrong date is worse than no date, so it gets called out.
  const lateCutoff = endIso ? addDays(endIso, 14) : null;
  const afterTerm = lateCutoff
    ? tasks
        .filter((t) => t.dueDate && t.dueDate > lateCutoff)
        .map((t) => ({ id: t.id, course: t.course, title: t.title, dueDate: t.dueDate, dueStr: fmtShort(t.dueDate) }))
    : [];
  const weeks = [];
  for (let mon = mondayOf(todayIso); mon <= lastDue; mon = addDays(mon, 7)) {
    const sun = addDays(mon, 6);
    const inWeek = (x) => x && x >= mon && x <= sun;

    const items = tasks
      .filter((t) => inWeek(t.dueDate))
      .map((t) => {
        const hours = leftH(t);
        const startBy = addDays(t.dueDate, -Math.ceil(hours / Math.max(0.25, hoursPerDay)));
        return {
          id: t.id,
          course: t.course,
          title: t.title,
          weight: t.weight,
          kind: t.kind,
          dueDate: t.dueDate,
          dueStr: fmtShort(t.dueDate),
          leftH: Math.round(hours * 10) / 10,
          startBy,
          startByStr: startBy <= todayIso ? 'now' : fmtShort(startBy),
        };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || String(a.id).localeCompare(String(b.id)));

    // Dates nobody has confirmed stay out of the arithmetic, but a week that
    // is quietly holding three of them deserves a mention.
    const tentative = tasks
      .filter((t) => !t.userConfirmed && inWeek(t.proposedDate))
      .map((t) => ({ course: t.course, title: t.title, dateStr: fmtShort(t.proposedDate) }));

    const loadH = Math.round(items.reduce((a, t) => a + t.leftH, 0) * 10) / 10;
    const exams = items.filter((t) => t.kind === 'exam').length;
    const big = items.filter((t) => Number(t.weight) >= 10).length;
    const ratio = capacityH ? loadH / capacityH : 0;

    let level = 'normal';
    if (ratio >= heavyRatio || exams >= 2 || big >= 3) level = 'heavy';
    else if (ratio >= busyRatio || big >= 2) level = 'busy';

    // Schedule the week's work backwards at your daily target: the item due
    // last finishes on its own due date, the one before it finishes where
    // that one had to start, and so on. Where the chain begins is the latest
    // day you can start and still make every date. Counting back from Sunday
    // instead would tell you to start a Monday deadline after it was due.
    const daysOfWork = Math.ceil(loadH / Math.max(0.5, dailyTargetH));
    let cursor = Infinity; // fractional days after this Monday
    for (const it of [...items].reverse()) {
      const dueEnd = daysBetween(mon, it.dueDate) + 1; // the end of its due day
      const finish = Math.min(cursor, dueEnd);
      cursor = finish - it.leftH / Math.max(0.5, dailyTargetH);
    }
    const startBy = Number.isFinite(cursor) ? addDays(mon, Math.floor(cursor)) : mon;
    const isThisWeek = mon <= todayIso && todayIso <= sun;

    weeks.push({
      mon,
      sun,
      label: isThisWeek ? 'This week' : `Week of ${fmtShort(mon)}`,
      rangeStr: `${fmtShort(mon)} – ${fmtShort(sun)}`,
      isThisWeek,
      items,
      tentative,
      loadH,
      capacityH,
      ratio: Math.round(ratio * 100) / 100,
      level,
      exams,
      big,
      startBy,
      startByStr: startBy <= todayIso ? 'now' : fmtShort(startBy),
      headline:
        level === 'normal'
          ? null
          : `${loadH} h of work due${exams ? `, ${exams} exam${exams > 1 ? 's' : ''}` : ''} — at ${dailyTargetH} h a day that is ${daysOfWork} day${
              daysOfWork === 1 ? '' : 's'
            } of work, so start ${startBy <= todayIso ? 'now' : `by ${fmtShort(startBy)}`}.`,
    });
  }

  // Empty weeks after the term are noise.
  const lastBusy = weeks.reduce((m, w, i) => (w.items.length || w.tentative.length ? i : m), -1);
  const termWeeks = weeks.filter((w, i) => i <= lastBusy || !endIso || w.mon <= endIso);

  return {
    weeks: termWeeks,
    flagged: termWeeks.filter((w) => w.level !== 'normal'),
    afterTerm,
    capacityH,
  };
}
