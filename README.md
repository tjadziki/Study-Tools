# Term Command Deck

A local study dashboard for Fall 2026 4A Mechanical. Ported from the Claude
Design canvas (`Term Command Deck features.zip`) and wired to the real course
materials in this workspace.

Everything runs on `localhost`. Nothing is uploaded anywhere, and the scanner
only ever **reads** course files.

## Run it

```bash
npm install
npm run dev
```

- client → http://localhost:5173
- API → http://127.0.0.1:5174

### Opening it without a terminal

`launcher/start-deck.vbs` is what a desktop shortcut should point at. It
starts both servers with no console window, waits until Vite is actually
answering, then opens the browser — and if the deck is already up it skips
straight to the browser, so double-clicking twice cannot start a second pair
of servers fighting over the same ports.

To make the shortcut, from PowerShell:

```powershell
$root = "<path to>\StudyHub"
$s = (New-Object -ComObject WScript.Shell).CreateShortcut("$([Environment]::GetFolderPath('Desktop'))\Term Command Deck.lnk")
$s.TargetPath   = "$env:SystemRoot\System32\wscript.exe"
$s.Arguments    = "`"$root\launcher\start-deck.vbs`""
$s.IconLocation = "$root\launcher\deck.ico,0"
$s.WindowStyle  = 7
$s.Save()
```

`launcher/stop-deck.cmd` stops the servers when you want the ports back;
`launcher/start-deck.cmd` runs them in a visible window when you need to see
why something failed.

These three files must stay CRLF — `cmd.exe` misparses a batch file with Unix
line endings — which is what `.gitattributes` is for.

## Layout

```
4A/                        <- SCAN_ROOT: course folders are detected here
  ME548/  ME559/  ME524/  ME597/  ME481/  HLTH101/
  StudyHub/                <- this app
    deck.db                <- all state, SQLite
    server/                <- Express: filesystem, parsing, persistence
    client/                <- Vite + React: the deck itself
```

Override the scan root with `DECK_SCAN_ROOT`, the database with `DECK_DB`, and
the ports with `DECK_PORT` / `DECK_CLIENT_PORT`.

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/state` | The whole deck in one payload |
| `POST /api/scan` | Walk, hash, parse changed files only (streams NDJSON progress) |
| `POST /api/tasks` · `POST /api/tasks/:id` | Add / patch / delete a component |
| `POST /api/errors` · `POST /api/errors/:id` | Bank or delete an error-log entry |
| `POST /api/concepts` · `POST /api/concepts/:id` | Open / patch / resolve a stuck concept |
| `POST /api/sessions` | Toggle a practice block, log a weekly review |
| `POST /api/conflicts/:id` | Accept or dismiss a conflict with a confirmed date |
| `POST /api/term-weeks` | Save / confirm the term calendar |
| `POST /api/plan` | Tick a study block off (or untick it) |
| `POST /api/class-blocks` | Replace the weekly timetable |
| `POST /api/phone-sync` | Push to the phone app now |
| `POST /api/settings` | Slip days and the scoring rules |
| `POST /api/reset` | Reseed the term (keeps the file-hash ledger) |

## The rule that matters

**Every extracted date is a candidate, never a fact.** Scanned dates land with
a `confidence`, the `sourceFile` they came from, and the `sourceSnippet` around
them, and sit in the review queue until confirmed. Once `userConfirmed` is set,
no rescan overwrites it — a disagreeing date is raised as a conflict instead.

Seeded **weights** are verified from the official outlines. Seeded **dates** are
not, so every component ships with no due date. The one exception is the ME 559
major project (Nov 30 2026), which the outline confirms.

## Preserved from the design canvas

- Triage priority `(weight/estHours × 10) + (1/max(daysUntilDue,1) × 30) + (droppable ? −5 : 0)`, with the reasoning shown inline
- Trap-task flagging (ME 524's assignments: low marks/hour, but the only pre-exam practice)
- 25-minute stuck timer and its forced escalation ladder
- Error log with a per-course review estimate
- Exam taper at T-14 / T-7 / T-3 / T-1, warning below 15 error entries at T-14
- Sunday weekly review ritual

## The daily plan

`Today` is the default view. It cuts your study window (07:30 – 21:00 by
default) down by your timetable, splits what is left into blocks, and fills
them from the same triage ranking the Triage view shows — so the two screens
can never disagree.

**Nothing about the plan is stored.** Confirm a date in the review queue, tick
an item off, move a class, and the next render is already the new plan; there
is nothing to regenerate. The only persisted thing is which blocks you
actually worked (`planLog`), because that is a fact about the past.

| Block | When it appears |
|---|---|
| **Deliverable** | Work due inside the planning horizon, or with no date yet |
| **Exam prep** | A dated exam, worded from its taper position (T-14 / T-7 / T-3 / T-1) |
| **Consolidate** | The first free block after a class, worded for lecture / lab / project meeting |
| **Retrieval** | An exam course with nothing due — practice, and bank the misses |
| **Read ahead** | A course with no weights or dates posted yet (ME 597) |
| **Unblock** | A stuck concept that has been open over a week |

Three rules stop it giving bad advice:

- **Near work first.** Marks-per-hour alone hands the day to whatever is
  cheapest: five 45-minute discussion posts outscore the project worth 18% of
  the course. Anything beyond `planHorizonDays` (21) is a pull-ahead and only
  gets the blocks left over once the day's target is met.
- **Two blocks per task per day**, unless it is due inside 48 hours.
- **A file is only named when it matches.** A block points at a real document
  from the scan, chosen by matching the task's name — digits included, so
  "Behaviour Change Pt 1" cannot open the Part 2 template. With no match, a
  deliverable block names no file at all: pointing at the wrong brief wastes
  the block, the same way a wrong deadline is worse than no deadline.

The week strip plans seven days ahead, retiring each day's work from the next,
so it is a plan rather than the same list seven times.

Timetable and study window are editable in Config. `npm test` covers the
planner (45 tests) alongside the date extractor.

## Outlook: exam readiness and busy weeks

The daily plan only ever looks at today. **Outlook** looks at the term.

**Exam readiness** walks the plan forward day by day — with each simulated
day seeing its deadlines from where *it* stands — and counts the prep every
exam actually gets before its date: dedicated exam blocks, plus that course's
retrieval practice, against the estimate minus hours already worked. Each
exam is *on track* (fits inside your daily target), *tight* (only fits if you
work the beyond-target blocks), or *short* (does not fit at all — start now).
Two exams on the same day compete for the same blocks, as they will in fact.

**Busy weeks** adds up the hours still left on everything due in each
Monday–Sunday week and sets them against the hours you study in a week.
Heavy and busy weeks get a start-by date, scheduled *backwards* from each
item's own deadline, so a Monday deadline inside the week pulls the start
earlier instead of being counted from Sunday. A confirmed deadline after the
exam period is flagged as a probable slip.

Blocks you let pass without ticking are *missed*: they stay on the page but
do not use up any estimate, so that work moves forward instead of vanishing.

## The iPhone app

A read-only view of the deck — Today, Triage and Outlook — deployed on
Vercel, behind a username and password. Dates still go in on the laptop.

```
laptop (source of truth) ──sync──▶ Vercel Blob (private) ◀──read── iPhone
```

- **It is the same code.** `client/phone/` is a second entry point that
  imports the laptop's own ranking and planning (`client/src/lib`) and its
  screens in read-only mode. The phone cannot rank or plan differently, and
  it plans from its own clock, so "right now" is right even if the laptop
  last synced yesterday.
- **Sync is one-way and opt-in.** With no `phone.local.json` it never
  happens and nothing leaves the machine. With it, every change is pushed a
  few seconds later, and an unchanged deck is never re-uploaded.
- **What leaves the laptop is an allowlist** (`server/phoneSync.js`):
  course codes, task titles, weights, estimates, *confirmed* dates, the
  timetable, the planner settings, which blocks were ticked, how many
  error-log entries each course has, and course file *names*. Never sent:
  source snippets and file paths, the text of error-log entries and weekly
  reflections, escalation contacts, unconfirmed dates, the review queue.
- **Sign-in**: one user, password hashed with scrypt, a signed HttpOnly
  cookie for 60 days, best-effort throttling on failures. Set it with
  `npm run phone:password` — you type the password; only its hash leaves
  your machine.

```bash
npm run phone:deploy      # build locally, ship a prebuilt deployment
npm run phone:password    # set or change the sign-in (then redeploys)
npm run phone:build       # build only
npm run phone:dev         # run it locally against a file store
```

## Design

The interface follows iOS 16: the system palette in light and dark
(following the OS), inset grouped lists, capsule badges, a segmented control,
round checkmarks, filled text fields, translucent bars, and the iOS type
scale. Components are [shadcn/ui](https://ui.shadcn.com) — copied in, not
installed, in `client/src/components/ui/` — on Radix primitives and
Tailwind, restyled to iOS. `components.json` lets the shadcn CLI add more.

The busy-weeks chart's status colours are checked with a palette validator
against the card surface in each theme; the dark-mode orange and red are
stepped down from iOS's own, which fail the dark lightness band.

## Scanning

`Rescan` (or `R`) walks every course folder, SHA-256s each file, and re-parses
**only** what is new or changed. On this workspace that is 131 files:

| | first scan | rescan |
|---|---|---|
| wall time | ~23 s | **~0.6 s** |

Progress streams live, so the header shows a real file counter rather than a
spinner. Raw extracted text is written to `scan-dump/` (gitignored) so parsing
quality can be checked by eye.

### Supported types

`.pdf` (pdfjs-dist, with a geometry pass that rebuilds reading order for
multi-column syllabi) · `.docx` (mammoth) · `.pptx` (jszip + XML) · `.html`
(table-aware) · `.md` `.txt` `.csv`. Skipped: anything over 25 MB, images,
binaries, and legacy `.ppt`/`.doc` (OLE, not zip — re-save as `.pptx` to
include them). A file that fails to parse is logged and the scan continues.

## Date extraction

Three incompatible date styles, all handled:

| Pattern | Example from these files | Handling |
|---|---|---|
| Absolute | `Friday, September 25, 2026 at 11:59 PM` | Parsed directly; a minute-precise time is itself read as a deadline signal |
| Absolute, numeric | `11/30/2026` | US month-first; flagged ambiguous when both halves are ≤ 12 |
| Week-relative | `Friday of Week 5` | Resolved against the term calendar; capped at low confidence until you confirm it |
| Range | `Sep 9 – Dec 8` | Term bounds, never a deadline |

Deliberately **not** treated as deadlines: the 40 bare `MM/DD` lecture rows in
the ME 524 outline, reading-week spans, and any date outside the term (the
ME 559 assignment PDFs in this workspace are from **Fall 2025** — 16 such dates
are found and ignored, with a note in the scan summary).

A schedule row naming two dates — `Original Posts … Reply Post …`, or
`Opens … Closes …` — collapses to the later one, because that is when the
deliverable is actually finished.

Run the tests with `npm test` (136).

## Build status

1. ✅ Scaffold, port, seeded data
2. ✅ File walker + hasher + `files` table; Rescan diff summary
3. ✅ PDF / DOCX / PPTX / HTML text extraction + raw dump
4. ✅ Date extraction with confidence scoring; review queue
5. ✅ Editable term calendar; week-relative resolution
6. ✅ Confirmed dates into triage; conflict detection
7. ✅ Daily planner: timetable, study window, Today view, week strip
8. ✅ Outlook: exam readiness forecast and busy-week detector
9. ✅ iPhone app on Vercel with sign-in; iOS 16 redesign on shadcn/ui
