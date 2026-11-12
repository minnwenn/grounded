#!/usr/bin/env node
/* Terminal control for the demo clock. It writes to the same database the app uses (Turso when TURSO_DATABASE_URL is
 * set, otherwise the local db file), so it works for the deployed site too:  vercel env pull .env  first.
 * Usage: node demo.js <status|next-day [n]|set-day <n>|evening|morning|reset>
 */
const { connect } = require("./db/client");
const { startup } = require("./db/init");
const [cmd, arg] = process.argv.slice(2);

if (!["status", "next-day", "set-day", "evening", "morning", "reset"].includes(cmd)) {
  console.error("Usage: node demo.js <status | next-day [n] | set-day <n> | evening | morning | reset>");
  process.exit(1);
}
(async () => {
  const db = connect();
  try {
    await startup(db, { demoAccounts: false });
    const row = await db.get("SELECT value FROM app_state WHERE key='demo'");
    let demo = Object.assign({ day: 0, evening: false, token: "t0" }, row ? JSON.parse(row.value) : {});
    if (cmd === "next-day") demo.day += Math.max(1, Math.min(60, Number(arg) || 1)), demo.evening = false;
    else if (cmd === "set-day") demo.day = Math.max(0, Math.min(1000, Math.floor(Number(arg)) || 0)), demo.evening = false;
    else if (cmd === "evening") demo.evening = true;
    else if (cmd === "morning") demo.evening = false;
    else if (cmd === "reset") demo = { day: 0, evening: false, token: "t" + Date.now() };
    if (cmd !== "status") await db.run("INSERT INTO app_state VALUES ('demo',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", JSON.stringify(demo));
    console.log("Demo day " + demo.day + ", " + (demo.evening ? "evening" : "morning") + (cmd === "reset" ? " (all demo progress reset)" : "") + "  [" + db.url.replace(/\?.*/, "") + "]");
    if (cmd !== "status") console.log("The app picks the change up within a couple of seconds.");
  } catch (e) {
    console.error("Could not update the demo clock: " + e.message);
    process.exitCode = 1;
  } finally { await db.close(); }
})();
