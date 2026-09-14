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
// DATES are not. Every seeded component ships with dueDate = NULL so that the
// deck cannot show a deadline nobody has confirmed. Dates arrive from the
// scanner as candidates and become real only once confirmed in the review
// queue. The single exception is the ME 559 major project, confirmed Nov 30.

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
    id: 'me548', code: 'ME 548', title: 'Numerical Control of Machine Tools',
    instructor: 'Erkorkmaz',
    meets: 'Mon/Wed 10:00–11:20 · Fri lab 16:30–19:20',
    contact: 'ME 548 project TAs — names on LEARN',
    contactShort: '548 TAs', examCourse: 1, weightsKnown: 1, sortOrder: 1,
  },
  {
    id: 'me559', code: 'ME 559', title: 'Finite Element Methods',
    instructor: 'Gryguc',
    meets: 'Wed 14:30–17:20',
    contact: 'ME 559 TAs — names on LEARN',
    contactShort: '559 TAs', examCourse: 1, weightsKnown: 1, sortOrder: 2,
  },
  {
    id: 'me524', code: 'ME 524', title: 'Advanced Dynamics & Vibrations',
    instructor: 'Salehian',
    meets: 'Tue 12:30–14:20 · Thu 11:30–12:20',
    contact: 'Instructor — email for an appointment. No TA exists on this course.',
    contactShort: 'Salehian', examCourse: 1, weightsKnown: 1, sortOrder: 3,
  },
  {
    id: 'me597', code: 'ME 597', title: 'Machine Learning for Mech Eng',
    instructor: 'Melek',
    meets: 'Mon 11:30–12:50 · Thu 13:30–14:50',
    contact: 'Instructor office hours',
    contactShort: 'Melek', examCourse: 0, weightsKnown: 0, sortOrder: 4,
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
    meets: 'Online · LEARN',
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
  // ── ME 548 · 45 + 20 + 18 + 10 + 7 = 100
  C('me548', 'work', 'Project 1 — CNC / MasterCAM / CMM', 18, 22, {
    note: '10% per day late penalty — the harshest on the term.',
  }),
  C('me548', 'work', 'Project 2 — cutting forces, MATLAB', 10, 14, {
    note: '10% per day late penalty.',
  }),
  C('me548', 'work', 'Project 3 — modal testing, FRF', 7, 10, {
    note: '10% per day late penalty.',
  }),
  C('me548', 'exam', 'Midterm', 20, 10),
  C('me548', 'exam', 'Final', 45, 20),

  // ── ME 559 · 35 + 30 + 25 + 10 = 100. Assignments: 5 set, best 4 count.
  C('me559', 'work', 'Assignment 1', 2.5, 5, {
    droppable: 1, note: 'Best 4 of 5 · 50% penalty inside 24h, zero after.',
  }),
  C('me559', 'work', 'Assignment 2', 2.5, 5, { droppable: 1, note: 'Best 4 of 5.' }),
  C('me559', 'work', 'Assignment 3', 2.5, 5, { droppable: 1, note: 'Best 4 of 5.' }),
  C('me559', 'work', 'Assignment 4', 2.5, 5, { droppable: 1, note: 'Best 4 of 5.' }),
  C('me559', 'work', 'Assignment 5', 2.5, 5, { droppable: 1, note: 'Best 4 of 5.' }),
  C('me559', 'work', 'Major project', 25, 40, {
    // The one date in the whole seed that is confirmed.
    dueDate: '2026-11-30', confidence: 'high', userConfirmed: 1, dateIsEstimate: 0,
    sourceSnippet: 'Confirmed from the official ME 559 outline: major project due Nov 30 2026.',
  }),
  C('me559', 'exam', 'Midterm', 30, 12),
  C('me559', 'exam', 'Final', 35, 18),

  // ── ME 524 · 42 + 42 + 16 = 100. The three assignments are the only
  // practice that exists before 84% of the grade, hence trap = 1.
  C('me524', 'work', 'Assignment 1', 5.3, 10, {
    trap: 1, note: 'The only practice that exists before 84% of this grade.',
  }),
  C('me524', 'work', 'Assignment 2', 5.3, 10, { trap: 1 }),
  C('me524', 'work', 'Assignment 3', 5.4, 10, { trap: 1 }),
  C('me524', 'exam', 'Midterm', 42, 16),
  C('me524', 'exam', 'Final', 42, 20),

  // ── ME 597 · weights unknown by design — extracted from the scan.

  // ── ME 481 · 45 + 20 + 20 + 10 + 5 = 100
  C('me481', 'work', 'Proposal', 20, 12),
  C('me481', 'work', 'Design review', 20, 10),
  C('me481', 'work', 'Progress meetings', 10, 6, {
    note: 'Recurring — attendance and a short update each time.',
  }),
  C('me481', 'work', 'Final report', 45, 30),
  C('me481', 'work', 'Teamwork assessment', 5, 1),

  // ── HLTH 101 · 45 + 20 + 20 + 15 = 100, plus a 1% bonus quiz.
  // Discussions: 5 set, best 4 count, 5% each. Titles are the real module
  // topics taken from the course folder.
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
};
