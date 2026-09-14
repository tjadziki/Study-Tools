-- Term Command Deck — schema.
-- Every table the spec calls for, plus the few extra columns the ported
-- mockup behaviours need (kind/droppable/trap/free/note). Column names
-- follow the spec exactly where the spec names them.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS courses (
  id          TEXT PRIMARY KEY,      -- slug, e.g. 'me548'
  code        TEXT NOT NULL UNIQUE,  -- display code, e.g. 'ME 548'
  title       TEXT NOT NULL,
  instructor  TEXT,
  folderPath  TEXT,                  -- absolute path, filled in by the scanner
  meets       TEXT,                  -- timetable line (display only)
  contact     TEXT,                  -- escalation target for the stuck ladder
  contactShort TEXT,
  examCourse  INTEGER NOT NULL DEFAULT 0, -- tracked by the retrieval bank
  weightsKnown INTEGER NOT NULL DEFAULT 1, -- 0 => blind spot card
  sortOrder   INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS components (
  id            TEXT PRIMARY KEY,
  courseId      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  weight        REAL NOT NULL DEFAULT 0,
  dueDate       TEXT,                 -- ISO yyyy-mm-dd, NULL when unknown
  confidence    TEXT NOT NULL DEFAULT 'high'   CHECK (confidence IN ('high','medium','low')),
  sourceFile    TEXT,                 -- path the date was extracted from
  sourceSnippet TEXT,                 -- surrounding sentence, for the review queue
  userConfirmed INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'todo'   CHECK (status IN ('todo','done','candidate','rejected')),
  estHours      REAL NOT NULL DEFAULT 1,

  -- preserved from the mockup
  kind          TEXT NOT NULL DEFAULT 'work'   CHECK (kind IN ('work','exam')),
  droppable     INTEGER NOT NULL DEFAULT 0,
  trap          INTEGER NOT NULL DEFAULT 0,    -- low marks/hour, high exam value
  free          INTEGER NOT NULL DEFAULT 0,    -- cheap marks, never skip
  note          TEXT NOT NULL DEFAULT '',
  dateIsEstimate INTEGER NOT NULL DEFAULT 0,   -- shows "(est.)" until confirmed

  createdAt     TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_components_course ON components(courseId);
CREATE INDEX IF NOT EXISTS idx_components_status ON components(status);

-- The scanner's hash ledger. A file is only re-parsed when its hash changes.
CREATE TABLE IF NOT EXISTS files (
  path        TEXT PRIMARY KEY,       -- absolute path
  hash        TEXT NOT NULL,          -- sha256 of contents
  lastParsed  TEXT,                   -- ISO timestamp, NULL if never parsed
  courseId    TEXT REFERENCES courses(id) ON DELETE SET NULL,
  size        INTEGER NOT NULL DEFAULT 0,
  mtime       TEXT,
  parseStatus TEXT NOT NULL DEFAULT 'pending'
                CHECK (parseStatus IN ('pending','ok','skipped','error')),
  parseError  TEXT,
  firstSeenAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_files_course ON files(courseId);

CREATE TABLE IF NOT EXISTS errors (
  id            TEXT PRIMARY KEY,
  courseId      TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  topic         TEXT NOT NULL DEFAULT 'Untagged',
  whatIGotWrong TEXT NOT NULL DEFAULT '',
  date          TEXT NOT NULL          -- ISO yyyy-mm-dd
);
CREATE INDEX IF NOT EXISTS idx_errors_course ON errors(courseId);

CREATE TABLE IF NOT EXISTS concepts (
  id          TEXT PRIMARY KEY,
  courseId    TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  openedAt    TEXT NOT NULL,           -- ISO timestamp
  resolvedAt  TEXT,                    -- ISO timestamp, NULL while open
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','escalated')),
  rungs       TEXT NOT NULL DEFAULT '[false,false,false]', -- escalation ladder state
  fromStuckTimer INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_concepts_status ON concepts(status);

CREATE TABLE IF NOT EXISTS sessions (
  id       TEXT PRIMARY KEY,
  courseId TEXT REFERENCES courses(id) ON DELETE CASCADE, -- NULL for weekly reviews
  date     TEXT NOT NULL,              -- ISO yyyy-mm-dd
  minutes  INTEGER NOT NULL DEFAULT 0,
  type     TEXT NOT NULL CHECK (type IN ('practice','planned','review')),
  note     TEXT NOT NULL DEFAULT ''    -- reflection text on a review row
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_slot ON sessions(type, date, IFNULL(courseId,''));

-- Week number -> date range. Seeded with a best guess; every week-relative
-- date stays untrusted until termCalendarConfirmed is set.
CREATE TABLE IF NOT EXISTS termWeeks (
  weekNumber    INTEGER PRIMARY KEY,
  startDate     TEXT NOT NULL,
  endDate       TEXT NOT NULL,
  isReadingWeek INTEGER NOT NULL DEFAULT 0
);

-- Raised when a rescan finds a date that disagrees with a confirmed one.
CREATE TABLE IF NOT EXISTS conflicts (
  id            TEXT PRIMARY KEY,
  componentId   TEXT NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  proposedDate  TEXT,
  currentDate   TEXT,
  confidence    TEXT NOT NULL DEFAULT 'low',
  sourceFile    TEXT,
  sourceSnippet TEXT,
  detectedAt    TEXT NOT NULL DEFAULT (datetime('now')),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed'))
);
CREATE INDEX IF NOT EXISTS idx_conflicts_status ON conflicts(status);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
