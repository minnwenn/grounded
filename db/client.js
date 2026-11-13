/* The database connection. One small async API over libSQL (SQLite-compatible), so the same code runs against
 *   - Turso on Vercel      TURSO_DATABASE_URL=libsql://...  TURSO_AUTH_TOKEN=...
 *   - a local file         DB_FILE=db/grounded.db   (the default when TURSO_DATABASE_URL is not set)
 *
 * Every method returns a Promise:
 *   get(sql, ...args)    first row as a plain object, or undefined
 *   all(sql, ...args)    array of plain objects
 *   run(sql, ...args)    { changes, lastInsertRowid }  (lastInsertRowid is a Number)
 *   exec(script)         several statements, no parameters
 *   batch([[sql, ...args], ...])   many statements in ONE round trip, all or nothing
 *   tx(async t => ...)   interactive transaction; t has get/all/run. Commits if the callback returns, rolls back if it throws.
 */
const path = require("path");
// The Vercel Turso integration may add a prefix (DATABASE_TURSO_DATABASE_URL); accept either spelling.
process.env.TURSO_DATABASE_URL ||= process.env.DATABASE_TURSO_DATABASE_URL;
process.env.TURSO_AUTH_TOKEN ||= process.env.DATABASE_TURSO_AUTH_TOKEN;
const { createClient } = require("@libsql/client");

const ROOT = path.join(__dirname, "..");
const LOCAL_FILE = process.env.DB_FILE || path.join(__dirname, "grounded.db");

const plain = rs => rs.rows.map(r => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));
const stmt = (sql, args) => ({ sql, args: args.map(a => (a === undefined ? null : a)) });

function api(ex) {
  return {
    get: async (sql, ...a) => plain(await ex.execute(stmt(sql, a)))[0],
    all: async (sql, ...a) => plain(await ex.execute(stmt(sql, a))),
    run: async (sql, ...a) => { const r = await ex.execute(stmt(sql, a)); return { changes: r.rowsAffected, lastInsertRowid: Number(r.lastInsertRowid ?? 0) }; }
  };
}

function connect(opts = {}) {
  const url = opts.url || process.env.TURSO_DATABASE_URL || "file:" + (path.isAbsolute(LOCAL_FILE) ? LOCAL_FILE : path.join(ROOT, LOCAL_FILE));
  const client = createClient({ url, authToken: opts.authToken || process.env.TURSO_AUTH_TOKEN || undefined });
  const db = Object.assign(api(client), {
    url,
    isLocal: url.startsWith("file:"),
    exec: script => client.executeMultiple(script),
    batch: async list => { await client.batch(list.map(([sql, ...a]) => stmt(sql, a)), "write"); },
    tx: async fn => {
      const t = await client.transaction("write");
      try { const r = await fn(api(t)); await t.commit(); return r; }
      catch (e) { try { await t.rollback(); } catch {} throw e; }
      finally { t.close(); }
    },
    close: () => client.close()
  });
  return db;
}

module.exports = { connect, LOCAL_FILE };
