#!/usr/bin/env node
/* Terminal control for the demo clock. The server must be running (npm start).
 * Usage: node demo.js <status|next-day [n]|set-day <n>|evening|morning|reset>
 */
const [cmd, arg] = process.argv.slice(2);
const base = "http://localhost:" + (process.env.PORT || 3000) + "/api/demo";
const actions = {"next-day":"next-day","set-day":"set-day",evening:"evening",morning:"morning",reset:"reset"};

if (cmd !== "status" && !actions[cmd]) {
  console.error("Usage: node demo.js <status | next-day [n] | set-day <n> | evening | morning | reset>");
  process.exit(1);
}
(async () => {
  try {
    const r = cmd === "status"
      ? await fetch(base)
      : await fetch(base, {method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({action: actions[cmd], n: arg})});
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    console.log("Demo day " + j.day + ", " + (j.evening ? "evening" : "morning") + (cmd === "reset" ? " (all demo progress reset)" : ""));
  } catch (e) {
    console.error("Could not reach the server (" + e.message + "). Is `npm start` running?");
    process.exit(1);
  }
})();
