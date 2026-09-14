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

Run the extractor's tests with `npm test` (49 tests).

## Build status

1. ✅ Scaffold, port, seeded data
2. ✅ File walker + hasher + `files` table; Rescan diff summary
3. ✅ PDF / DOCX / PPTX / HTML text extraction + raw dump
4. ✅ Date extraction with confidence scoring; review queue
5. ✅ Editable term calendar; week-relative resolution
6. ✅ Confirmed dates into triage; conflict detection
