-- Grounded database (SQLite). Every photo a student submits is kept (photo_images) so their teacher can see it.
-- Photos that fail the check are never submitted, so they are never kept.
PRAGMA foreign_keys = ON;

-- ---------- people and organisations ----------
CREATE TABLE cohorts (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE                       -- e.g. '2026 A'
);

CREATE TABLE schools (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  cohort_id  INTEGER NOT NULL REFERENCES cohorts(id)
);

CREATE TABLE users (                               -- teachers and CoffeeBot staff (students join with a class code)
  id             INTEGER PRIMARY KEY,
  role           TEXT NOT NULL CHECK (role IN ('teacher','coffeebot')),
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,                    -- scrypt, see db/auth.js
  school_id      INTEGER REFERENCES schools(id),   -- teachers only
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE classes (
  id          INTEGER PRIMARY KEY,
  school_id   INTEGER NOT NULL REFERENCES schools(id),
  teacher_id  INTEGER REFERENCES users(id),
  name        TEXT NOT NULL,
  code        TEXT NOT NULL UNIQUE COLLATE NOCASE  -- students log in with this
);

CREATE TABLE students (
  id             INTEGER PRIMARY KEY,
  class_id       INTEGER NOT NULL REFERENCES classes(id),
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,                    -- scrypt, see db/auth.js
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  last_active    TEXT                              -- 'YYYY-MM-DD' on the app clock (includes the demo offset)
);
CREATE UNIQUE INDEX idx_students_name ON students(class_id, name COLLATE NOCASE);

-- Login sessions for both kinds of account. Only a hash of the cookie token is stored.
CREATE TABLE sessions (
  token_hash  TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('user','student')),
  user_id     INTEGER NOT NULL,                    -- users.id or students.id, depending on kind
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- content (edited by CoffeeBot, not by students) ----------
CREATE TABLE levels (
  n     INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  at    INTEGER NOT NULL                           -- points needed
);

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,                  -- 'p4'
  name          TEXT NOT NULL,
  level         INTEGER NOT NULL REFERENCES levels(n),
  pts           INTEGER NOT NULL,
  description   TEXT NOT NULL,
  photo_prompt  TEXT NOT NULL,                     -- what the AI looks for
  plant         TEXT NOT NULL,
  color         TEXT NOT NULL
);

CREATE TABLE project_steps (
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  idx         INTEGER NOT NULL,                    -- 0-based; the last step is the photo
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  PRIMARY KEY (project_id, idx)
);

CREATE TABLE weeks (
  n     INTEGER PRIMARY KEY,                       -- 1..4
  name  TEXT NOT NULL,
  goal  TEXT NOT NULL
);
CREATE TABLE week_projects (
  week_n      INTEGER NOT NULL REFERENCES weeks(n),
  project_id  TEXT NOT NULL REFERENCES projects(id),
  PRIMARY KEY (week_n, project_id)
);

CREATE TABLE accessories (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  slot   TEXT NOT NULL CHECK (slot IN ('head','face','neck')),
  how    TEXT NOT NULL CHECK (how IN ('buy','streak','project','mission')),
  cost   INTEGER,                                  -- beans, for 'buy'
  need   INTEGER,                                  -- streak days / projects / missions
  hint   TEXT
);

-- Questions are drafted once by AI, reviewed by a person, then stored: no AI call per student.
CREATE TABLE quiz_questions (
  id           INTEGER PRIMARY KEY,
  question     TEXT NOT NULL,
  options      TEXT NOT NULL,                      -- JSON array of strings
  answer_idx   INTEGER NOT NULL,                   -- -1 = reflection question (no wrong answer)
  explanation  TEXT NOT NULL,
  reviewed_by  INTEGER REFERENCES users(id),
  reviewed_at  TEXT                                -- NULL = not yet allowed to be shown
);

-- ---------- student activity ----------
CREATE TABLE student_projects (
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  project_id    TEXT NOT NULL REFERENCES projects(id),
  steps_done    INTEGER NOT NULL DEFAULT 0 CHECK (steps_done BETWEEN 0 AND 5),
  fails         INTEGER NOT NULL DEFAULT 0,        -- failed photo checks since the last pass or teacher review
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at  TEXT,
  PRIMARY KEY (student_id, project_id)
);

CREATE TABLE photo_submissions (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  project_id  TEXT NOT NULL REFERENCES projects(id),
  verdict     TEXT NOT NULL CHECK (verdict IN ('pass','unsure','fail')),
  confidence  REAL,
  feedback    TEXT,
  note        TEXT,                                -- why a teacher is asked to look, e.g. 'AI unsure (confidence 0.42)'
  mode        TEXT NOT NULL CHECK (mode IN ('ai','demo')),
  status      TEXT NOT NULL CHECK (status IN ('approved','pending','redo','rejected')),
  reviewed_by INTEGER REFERENCES users(id),        -- teacher
  reviewed_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_photos_pending ON photo_submissions(status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS photo_images (           -- every submitted photo, shown only to the student's own teacher
  submission_id  INTEGER PRIMARY KEY REFERENCES photo_submissions(id) ON DELETE CASCADE,
  jpeg           BLOB NOT NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- One ledger for points (levels) and beans (accessories). Balances are sums, so history is auditable.
CREATE TABLE ledger (
  id          INTEGER PRIMARY KEY,
  student_id  INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('points','beans')),
  delta       INTEGER NOT NULL,
  reason      TEXT NOT NULL,                       -- 'photo_verified','teacher_approved','step','quiz','purchase'
  project_id  TEXT REFERENCES projects(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_ledger_student ON ledger(student_id, kind);

CREATE TABLE quiz_answers (
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  quiz_date    TEXT NOT NULL,                      -- 'YYYY-MM-DD', one per day keeps the streak
  question_id  INTEGER NOT NULL REFERENCES quiz_questions(id),
  pick_idx     INTEGER NOT NULL,
  correct      INTEGER NOT NULL CHECK (correct IN (0,1)),
  PRIMARY KEY (student_id, quiz_date)
);

-- Streak and mood are derived from quiz_answers dates; only the cached streak lives here.
CREATE TABLE buddies (
  student_id  INTEGER PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  streak      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE student_accessories (
  student_id    INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  accessory_id  TEXT NOT NULL REFERENCES accessories(id),
  equipped      INTEGER NOT NULL DEFAULT 0 CHECK (equipped IN (0,1)),
  PRIMARY KEY (student_id, accessory_id)
);

-- ---------- the class garden ----------
-- A student chooses a plant for each project they finish. It is planted on the app's calendar day and grows over the
-- next days (see plantStage in db/store.js).
CREATE TABLE IF NOT EXISTS garden_plants (
  id           INTEGER PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  project_id   TEXT NOT NULL REFERENCES projects(id),
  species      TEXT NOT NULL,                   -- an id from `plants` in js/data.js
  planted_day  INTEGER NOT NULL,                -- days since 1970-01-01 on the app clock (db/clock.js)
  UNIQUE (student_id, project_id)
);

-- ---------- class missions ----------
CREATE TABLE missions (
  id          INTEGER PRIMARY KEY,
  class_id    INTEGER NOT NULL REFERENCES classes(id),
  name        TEXT NOT NULL,
  goal        INTEGER NOT NULL,
  unit        TEXT NOT NULL CHECK (unit IN ('steps','projects')),
  created_by  INTEGER REFERENCES users(id),
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- batches and verified kg ----------
CREATE TABLE batches (
  id         TEXT PRIMARY KEY,                     -- 'B-1042'
  school_id  INTEGER NOT NULL REFERENCES schools(id),
  cohort_id  INTEGER NOT NULL REFERENCES cohorts(id),
  outlet     TEXT NOT NULL,                     -- CoffeeBot machine location
  kg         REAL NOT NULL,
  verified   INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0,1))
);
CREATE TABLE batch_events (
  id        INTEGER PRIMARY KEY,
  batch_id  TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  happened  TEXT,                                  -- NULL = still pending
  text      TEXT NOT NULL,
  done      INTEGER NOT NULL DEFAULT 1 CHECK (done IN (0,1))
);

-- ---------- handy views ----------
CREATE VIEW student_totals AS
SELECT s.id AS student_id, s.name, s.class_id,
  COALESCE((SELECT SUM(delta) FROM ledger l WHERE l.student_id = s.id AND l.kind = 'points'), 0) AS points,
  COALESCE((SELECT SUM(delta) FROM ledger l WHERE l.student_id = s.id AND l.kind = 'beans'), 0)  AS beans,
  COALESCE((SELECT SUM(steps_done) FROM student_projects p WHERE p.student_id = s.id), 0)        AS steps_done,
  (SELECT COUNT(*) FROM student_projects p WHERE p.student_id = s.id AND p.steps_done = 5)       AS projects_done
FROM students s;

CREATE VIEW student_levels AS
SELECT t.*, (SELECT MAX(n) FROM levels WHERE at <= t.points) AS level
FROM student_totals t;

CREATE VIEW school_kg AS
SELECT sc.id AS school_id, sc.name, co.name AS cohort, COALESCE(SUM(b.kg), 0) AS kg
FROM schools sc JOIN cohorts co ON co.id = sc.cohort_id
LEFT JOIN batches b ON b.school_id = sc.id
GROUP BY sc.id;
