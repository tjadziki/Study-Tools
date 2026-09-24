import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Seed data.
//
// Escalation contacts: the repo ships the generic role for each course, because
// TA names are other people's information and this repo is public. Real names
// live in the gitignored server/contacts.local.json and are merged in below, so
// a local reset keeps them.
//
// WEIGHTS are verified against the official outlines and are hardcoded here.
//
// DATES are seeded only where an outline's own Assessments table states one,
// and those ship userConfirmed: a date read off the official table is a fact,
// not a parser's guess. A date the outline itself calls "tentative" ships
// unconfirmed and waits in the review queue like any scanned candidate.
// Everything else ships with no date at all — the deck must never show a
// deadline nobody has confirmed.
//
// Roster as of 2026-09-22: ME 548 and ME 524 dropped, MTE 544 and MSE 331
// added. HLTH 101 stays; it is asynchronous, so it appears on no timetable,
// which is not the same thing as being gone.

export const TERM = { start: '2026-09-09', end: '2026-12-08' };

/** Real contacts if the local file exists; otherwise the generic role text. */
const LOCAL_CONTACTS = (() => {
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    return JSON.parse(fs.readFileSync(path.join(here, 'contacts.local.json'), 'utf8'));
  } catch {
    return {};
  }
})();

const COURSE_DEFS = [
  {
    id: 'mte544', code: 'MTE 544', title: 'Autonomous Mobile Robots',
    instructor: 'Yue Hu',
    meets: 'Mon/Wed 10:00–11:20 · Mon lab 14:30–17:20 · Thu tut 15:00–15:50',
    contact: 'MTE 544 TAs — names on LEARN',
    contactShort: '544 TAs', examCourse: 1, weightsKnown: 1, sortOrder: 1,
  },
  {
    id: 'mse331', code: 'MSE 331', title: 'Introduction to Optimization',
    instructor: 'Alumur Alev',
    meets: 'Tue/Thu 11:30–12:50 · Wed tut 8:30–9:20',
    contact: 'MSE 331 TA — name on LEARN',
    contactShort: '331 TA', examCourse: 1, weightsKnown: 1, sortOrder: 2,
  },
  {
    id: 'me559', code: 'ME 559', title: 'Finite Element Methods',
    instructor: 'Gryguc',
    meets: 'Wed 14:30–17:20',
    contact: 'ME 559 TAs — names on LEARN',
    contactShort: '559 TAs', examCourse: 1, weightsKnown: 1, sortOrder: 3,
  },
  {
    // No midterm and no final exam — the whole grade is coursework, which is
    // why examCourse is 0 and nothing here ever enters the exam taper.
    id: 'me597', code: 'ME 597', title: 'Machine Learning for Mech Eng',
    instructor: 'Melek',
    meets: 'Mon 11:30–12:50 · Thu 13:30–14:50',
    contact: 'Instructor office hours',
    contactShort: 'Melek', examCourse: 0, weightsKnown: 1, sortOrder: 4,
  },
  {
    id: 'me481', code: 'ME 481', title: 'Design Project 1',
    instructor: '—',
    meets: 'Tue/Thu 16:00–17:20',
    contact: 'Project advisor / course TA',
    contactShort: 'advisor', examCourse: 0, weightsKnown: 1, sortOrder: 5,
  },
  {
    id: 'hlth101', code: 'HLTH 101', title: 'Intro to Health, Illness and Wellness',
    instructor: 'online',
    meets: 'Online · LEARN · no scheduled meetings',
    contact: 'Course staff via LEARN',
    contactShort: 'LEARN staff', examCourse: 0, weightsKnown: 1, sortOrder: 6,
  },
];

export const COURSES = COURSE_DEFS.map((c) => ({
  ...c,
  contact: LOCAL_CONTACTS[c.id] || c.contact,
}));

// estHours are starting estimates, not facts — they are editable in Config and
// re-estimated every Sunday review. They feed the marks/hour half of the score.
const C = (courseId, kind, title, weight, estHours, extra = {}) => ({
  id: `${courseId}-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 26)}`,
  courseId, kind, title, weight, estHours,
  dueDate: null,
  confidence: 'low',
  sourceFile: null,
  sourceSnippet: null,
  userConfirmed: 0,
  status: 'todo',
  droppable: 0, trap: 0, free: 0, note: '',
  dateIsEstimate: 1,
  ...extra,
});

export const COMPONENTS = [
  // ── MTE 544 · 40 + 10 + 15 + 35 = 100 ───────────────────────────────────
  // Lab dates are the outline's own "tentative due dates" for the Monday
  // section, so they ship unconfirmed and wait in the review queue.
  C('mte544', 'work', 'Lab 1 — TurtleBot 4 / ROS2 sensors', 10, 9, {
    dueDate: '2026-10-19', confidence: 'medium',
    note: 'Monday section. A first version of the code is due 1–2 days before the lab itself.',
  }),
  C('mte544', 'work', 'Lab 2 — closed-loop trajectory control', 10, 9, {
    dueDate: '2026-11-02', confidence: 'medium',
    note: 'Monday section. Code due 1–2 days before the lab.',
  }),
  C('mte544', 'work', 'Lab 3 — estimation and mapping', 10, 9, {
    dueDate: '2026-11-23', confidence: 'medium',
    note: 'Monday section. Code due 1–2 days before the lab.',
  }),
  C('mte544', 'work', 'Lab 4 — planning and navigation', 10, 9, {
    dueDate: '2026-12-07', confidence: 'medium',
    note: 'Monday section. Code due 1–2 days before the lab.',
  }),
  C('mte544', 'work', 'HW 1', 5, 6, {
    dueDate: '2026-09-30', confidence: 'medium',
    note: 'The outline disagrees with itself: the Assessments table says Wed Sep 30 (printed "September 39th"), the Assignments section says Sep 28.',
  }),
  C('mte544', 'work', 'HW 2', 5, 6, {
    dueDate: '2026-11-11', confidence: 'medium',
    note: 'The outline disagrees with itself: the Assessments table says Wed Nov 11, the Assignments section says Nov 9.',
  }),
  C('mte544', 'work', 'Lab group formation', 0, 0.5, {
    dueDate: '2026-09-25', confidence: 'high', userConfirmed: 1, dateIsEstimate: 0, free: 1,
    note: 'Carries no marks but gates all 40% of the labs. Teams of 3, on the Excel sheet linked in LEARN.',
  }),
  C('mte544', 'exam', 'Midterm quiz', 15, 10, {
    dueDate: '2026-10-29', confidence: 'high', userConfirmed: 1, dateIsEstimate: 0,
    note: 'In person. Same day as the MSE 331 midterm.',
  }),
  C('mte544', 'exam', 'Final — take-home project + oral', 35, 24, {
    dueDate: '2026-12-11', confidence: 'high', userConfirmed: 1, dateIsEstimate: 0,
    note: 'Code and report due Dec 11, oral Dec 14–16. Both halves must be passed separately; project released Dec 2.',
  }),

  // ── MSE 331 · 35 + 10 + 10 + 45 = 100 ───────────────────────────────────
  C('mse331', 'exam', 'Midterm exam', 35, 14, {
    dueDate: '2026-10-29', confidence: 'high', userConfirmed: 1, dateIsEstimate: 0,
    note: 'In class, Crowdmark. Everything to the end of Week 6. Same day as the MTE 544 midterm.',
  }),
  C('mse331', 'work', 'Project Part I', 10, 10, {
    dueDate: '2026-11-17', confidence: 'high', userConfirmed: 1, dateIsEstimate: 0,
    note: 'Teams of 3. Crowdmark. The deadline can be extended up to 48h.',
  }),
  C('mse331', 'work', 'Project Part II', 10, 10, {
    dueDate: '2026-12-08', confidence: 'high', userConfirmed: 1, dateIsEstimate: 0,
    note: 'Teams of 3. Crowdmark.',
  }),
  C('mse331', 'exam', 'Final exam', 45, 20, {
    note: 'Final exam period — registrar-scheduled, so no date until the timetable is out.',
  }),

  // ── ME 559 · 35 + 30 + 25 + 10 = 100. Assignments: 5 set, best 4 count.
  C('me559', 'work', 'Assignment 1', 2.5, 5, {
    droppable: 1, note: 'Best 4 of 5 · 50% penalty inside 24h, zero after.',
  }),
  C('me559', 'work', 'Assignment 2', 2.5, 5, { droppable: 1, note: 'Best 4 of 5.' }),
  C('me559', 'work', 'Assignment 3', 2.5, 5, { droppable: 1, note: 'Best 4 of 5.' }),
  C('me559', 'work', 'Assignment 4', 2.5, 5, { droppable: 1, note: 'Best 4 of 5.' }),
  C('me559', 'work', 'Assignment 5', 2.5, 5, { droppable: 1, note: 'Best 4 of 5.' }),
  C('me559', 'work', 'Major project', 25, 40, {
    dueDate: '2026-11-30', confidence: 'high', userConfirmed: 1, dateIsEstimate: 0,
    sourceSnippet: 'Confirmed from the official ME 559 outline: major project due Nov 30 2026.',
  }),
  C('me559', 'exam', 'Midterm', 30, 12),
  C('me559', 'exam', 'Final', 35, 18),

  // ── ME 597 · 48 + 12 + 25 + 15 = 100, and no exam of any kind ───────────
  // No dates are published for any of it; labs are announced in class the
  // week before. That makes this the course most likely to ambush you.
  C('me597', 'work', 'Lab reports (with code)', 48, 30, {
    note: 'Weekly case studies from Module 2 onward. Each lab is announced in class the week before.',
  }),
  C('me597', 'work', 'Project proposal', 12, 8),
  C('me597', 'work', 'Course project final report', 25, 20),
  C('me597', 'work', 'Final presentation', 15, 6),

  // ── ME 481 · 45 + 20 + 20 + 10 + 5 = 100 ────────────────────────────────
  C('me481', 'work', 'Proposal', 20, 12),
  C('me481', 'work', 'Design review', 20, 10),
  C('me481', 'work', 'Progress meeting 1', 5, 3),
  C('me481', 'work', 'Progress meeting 2', 5, 3),
  C('me481', 'work', 'Final report', 45, 30),
  C('me481', 'work', 'Teamwork assessment', 5, 1),

  // ── HLTH 101 · 45 + 20 + 20 + 15 = 100, plus a 1% bonus quiz.
  // Online and asynchronous, which is why it has no timetable blocks — and
  // exactly why it is the easiest course on the term to let slide.
  C('hlth101', 'work', 'Discussion 1 — Introduce yourself', 5, 0.75, { droppable: 1, free: 1, note: 'Best 4 of 5.' }),
  C('hlth101', 'work', 'Discussion 2 — Racism as a determinant of health', 5, 0.75, { droppable: 1, free: 1, note: 'Best 4 of 5.' }),
  C('hlth101', 'work', 'Discussion 3 — Stress and health', 5, 0.75, { droppable: 1, free: 1, note: 'Best 4 of 5.' }),
  C('hlth101', 'work', 'Discussion 4 — The fentanyl epidemic', 5, 0.75, { droppable: 1, free: 1, note: 'Best 4 of 5.' }),
  C('hlth101', 'work', 'Discussion 5 — COVID-19 pandemic', 5, 0.75, { droppable: 1, free: 1, note: 'Best 4 of 5.' }),
  C('hlth101', 'work', 'Bonus quiz', 1, 0.5, { droppable: 1, free: 1, note: '+1% on the term. Free.' }),
  C('hlth101', 'work', 'Behaviour Change Pt 1', 15, 5),
  C('hlth101', 'work', 'Behaviour Change Pt 2', 20, 8),
  C('hlth101', 'exam', 'Term test 1', 15, 4),
  C('hlth101', 'exam', 'Term test 2', 15, 4),
  C('hlth101', 'exam', 'Term test 3', 15, 5),
];

// Best-guess Fall 2026 calendar. Lectures run Sep 9 (Wed) – Dec 8.
// Reading week is stored as weekNumber 0 with isReadingWeek = 1 so it does not
// consume a lecture-week number — "Friday of Week 5" must resolve past it.
// UNCONFIRMED: settings.termCalendarConfirmed stays 'false' until the user
// confirms this screen, and no week-relative date is trusted before then.
export const TERM_WEEKS = [
  { weekNumber: 1,  startDate: '2026-09-09', endDate: '2026-09-13', isReadingWeek: 0 },
  { weekNumber: 2,  startDate: '2026-09-14', endDate: '2026-09-20', isReadingWeek: 0 },
  { weekNumber: 3,  startDate: '2026-09-21', endDate: '2026-09-27', isReadingWeek: 0 },
  { weekNumber: 4,  startDate: '2026-09-28', endDate: '2026-10-04', isReadingWeek: 0 },
  { weekNumber: 5,  startDate: '2026-10-05', endDate: '2026-10-11', isReadingWeek: 0 },
  { weekNumber: 0,  startDate: '2026-10-12', endDate: '2026-10-18', isReadingWeek: 1 },
  { weekNumber: 6,  startDate: '2026-10-19', endDate: '2026-10-25', isReadingWeek: 0 },
  { weekNumber: 7,  startDate: '2026-10-26', endDate: '2026-11-01', isReadingWeek: 0 },
  { weekNumber: 8,  startDate: '2026-11-02', endDate: '2026-11-08', isReadingWeek: 0 },
  { weekNumber: 9,  startDate: '2026-11-09', endDate: '2026-11-15', isReadingWeek: 0 },
  { weekNumber: 10, startDate: '2026-11-16', endDate: '2026-11-22', isReadingWeek: 0 },
  { weekNumber: 11, startDate: '2026-11-23', endDate: '2026-11-29', isReadingWeek: 0 },
  { weekNumber: 12, startDate: '2026-11-30', endDate: '2026-12-06', isReadingWeek: 0 },
  { weekNumber: 13, startDate: '2026-12-07', endDate: '2026-12-08', isReadingWeek: 0 },
];


/* ── the weekly timetable ──────────────────────────────────────────────────
   Taken from the Quest schedule. Times are minutes from midnight so the
   planner can do arithmetic on them; the Config screen edits them as clock
   times. weekday follows Date#getDay(): 0 Sun .. 6 Sat.
   HLTH 101 has no blocks — it is asynchronous on LEARN, which is exactly why
   it is so easy to let slide.
   ──────────────────────────────────────────────────────────────────────── */
const B = (courseId, weekday, startMin, endMin, kind = 'LEC', label = '') => ({
  id: `${courseId}-${weekday}-${startMin}`,
  courseId, weekday, startMin, endMin, kind, label,
});

export const CLASS_BLOCKS = [
  B('mte544', 1, 600, 680, 'LEC'),         // Mon 10:00–11:20  RCH 307
  B('me597',  1, 690, 770, 'LEC'),         // Mon 11:30–12:50  DWE 2402
  B('mte544', 1, 870, 1040, 'LAB'),        // Mon 14:30–17:20  E3 3178 (section 101)
  B('mse331', 2, 690, 770, 'LEC'),         // Tue 11:30–12:50  CPH 3681
  B('me481',  2, 960, 1040, 'PRJ'),        // Tue 16:00–17:20  MC 4045
  B('mse331', 3, 510, 560, 'TUT'),         // Wed 08:30–09:20  E2 1736
  B('mte544', 3, 600, 680, 'LEC'),         // Wed 10:00–11:20  RCH 307
  B('me559',  3, 870, 1040, 'LEC'),        // Wed 14:30–17:20  MC 4041
  B('mse331', 4, 690, 770, 'LEC'),         // Thu 11:30–12:50  CPH 3681
  B('me597',  4, 810, 890, 'LEC'),         // Thu 13:30–14:50  E5 3101
  B('mte544', 4, 900, 950, 'TUT'),         // Thu 15:00–15:50  E5 3101
  B('me481',  4, 960, 1040, 'PRJ'),        // Thu 16:00–17:20  MC 4045
];

export const SETTINGS = {
  termStart: TERM.start,
  termEnd: TERM.end,
  termCalendarConfirmed: 'false',
  lastScannedAt: '',
  slipDays: '3',
  // Rules that were editable props on the design canvas.
  stuckMinutes: '25',
  minErrorsAtT14: '15',
  examHorizonDays: '21',
  minutesPerErrorReview: '5.5',

  // ── the daily planner ───────────────────────────────────────────────────
  // The window you are actually willing to work in, and how much of it you
  // are committing to. Everything the Today view shows is derived from these
  // five numbers plus the timetable above — change one and the plan rebuilds.
  dayStartMin: '450',          // 07:30
  dayEndMin: '1260',           // 21:00 — the hard stop before sleep
  dailyTargetHours: '4',
  weekendTargetHours: '4',
  minBlockMinutes: '45',       // shorter than this is not a study block
  maxBlockMinutes: '110',      // longer than this and attention goes
  breakMinutes: '15',
  classBufferMinutes: '15',    // walking / settling either side of a class
  // How far ahead the plan is willing to reach. Work further out than this is
  // a pull-ahead and only gets the blocks left over once the day's target is
  // met — otherwise a 45-minute discussion post due in November outscores the
  // project worth 18% of the course, purely on marks per hour.
  planHorizonDays: '21',
  // When a deadline stops competing on marks per hour. Slack is days left
  // minus the days of work a task still needs at focusHoursPerDay; once it
  // drops to urgentSlackDays, the task is ranked by deadline instead.
  urgentSlackDays: '7',
  focusHoursPerDay: '2',
};
