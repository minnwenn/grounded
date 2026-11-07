# Bean Again

A lightweight web app for CoffeeBot, schools and students: a 4-week journey of coffee ground projects, a Bean Buddy, class gardens, teacher review and a CoffeeBot dashboard. This is a prototype with demo data. Accounts, payments and the live data pipeline are simulated.

## Run

Requires Node 22 or newer.

- **Quick look**: open `index.html` in a browser (the demo clock stays at day 0).
- **Full app:**
  1. `npm install` (installs the Anthropic SDK and zod, used by the AI photo check)
  2. Optional, for the AI photo check: `cp .env.example .env` and put your key after `ANTHROPIC_API_KEY=`. `.env` is git-ignored, so the key never goes to GitHub.
  3. `npm start`
  4. Open http://localhost:3000

## Photo check

Each final photo goes through three steps:

1. **Quick check on the device** (MobileCLIP-S0, `js/clip-check.js`). A clear mismatch stops here and counts as a failed try. Nothing is sent anywhere.
2. **AI check** (Claude, `/api/check` in `server.js`, needs `ANTHROPIC_API_KEY` in `.env`). Pass counts immediately. Unsure goes to the teacher. Fail counts as a failed try.
3. **Teacher review**, only for photos the AI is unsure about, or that are still failing after 3 retakes (4 tries in all, set by `aiRetakeLimit` in `js/dashboard-data.js`). Approve counts as verified. Redo sends the student back to the photo step.

Without an API key, the AI step is skipped. A quick-check pass then counts on its own, and the screen says "quick check only (AI unavailable)".

Quick check details: the image model (~23 MB) downloads once when a student opens a photo step. A photo passes if its project is the best match at 60% or more, and fails below 10%. Prompts are precomputed in `js/clip-labels.js` (edit `tools/make-clip-labels.mjs` to change them). On 44 sample photos it passed 22/26 correct photos and 0/72 wrong-photo checks. The prompts were tuned on those same photos, so expect lower accuracy on real ones. The 8-bit 12 MB model version is broken: use fp16. Photos are compressed to under 400 kB before checking and are never stored.

## Demo controls (terminal only)

There are no demo buttons in the app. The demo clock is driven from a second terminal while `npm start` is running. The open browser tabs pick up changes within a few seconds.

| Command | What it does |
|---|---|
| `npm run demo:next-day` | Moves the demo forward one day (resets the evening). Use it to show streaks, the sad and mouldy Bean Buddy, and a fresh daily quiz. |
| `node demo.js next-day 3` | Jumps forward several days. |
| `node demo.js set-day 7` | Sets the demo to a specific day number. |
| `npm run demo:evening` | Sets the time of day to evening, so the Buddy gets sleepy if the quiz isn't done. |
| `npm run demo:morning` | Sets it back to morning. |
| `npm run demo:reset` | Resets the demo to day 0 and clears all student progress, points, beans and flagged photos. Logins are kept. |
| `node demo.js status` | Shows the current demo day and time of day. |

Notes:
- Commands only work from the machine running the server (localhost). Requests from other machines are refused.
- The demo day is saved in `.demo-state.json` (git-ignored), so restarting the server keeps it. Use `npm run demo:reset` to start clean.
- If you started the server on another port, run commands with `PORT=4000 node demo.js status`.
- When opened straight from `index.html` (no server), the demo day stays fixed at day 0.

## Database

A SQLite database holds everything the app needs: schools, classes, students, projects, progress, photo results, points and beans, quiz answers, missions and batches. It uses Node's built-in `node:sqlite`, so there is nothing to install. It is **not connected to the app yet**: the app still keeps its state in the browser and reads demo content from `js/data.js`.

- `npm run db:init` creates `db/bean.db` from `db/schema.sql` and fills it with the demo content.
- `npm run db:reset` wipes it and recreates it.
- Inspect it with `sqlite3 db/bean.db` or any SQLite viewer.

Design notes:
- **Points and beans are a ledger** (`ledger` table) and balances are sums, so every change can be traced. The `student_levels` view gives each student's points, beans and level.
- **Photos are never stored.** `photo_submissions` keeps only the AI verdict, confidence, feedback and the teacher's review (`pending`, `approved`, `redo`).
- **Quiz questions** carry `reviewed_by` and `reviewed_at`, so only human-reviewed questions are served.
- **Passwords** for teachers and CoffeeBot staff are hashed with scrypt (`db/auth.js`). Students join with a class code and have no password.
- Mood and streaks are worked out from the dates in `quiz_answers`, not stored.
- `school_kg` view totals kg per school. Add real batch data to `batches` and `batch_events`.

## Demo logins

- **Student:** class code `BEAN-4F2K` and any name.
- **Teacher and CoffeeBot:** any email and password.

## Files

- `index.html`, `css/`, `js/` - the app (plain HTML, CSS and JavaScript)
- `js/data.js` - projects, weeks, levels, quiz questions and demo data
- `db/` - database schema (`schema.sql`), seed script (`init.js`) and password hashing (`auth.js`)
- `server.js` - serves the app, runs the AI photo check, and holds the demo clock
- `demo.js` - the terminal control for the demo clock
