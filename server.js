/* Local server:  npm install, then npm start.  It runs the same handler as the Vercel function (handler.js) and serves
 * public/ itself. On Vercel, public/ is served by the platform and api/[...path].js runs the handler. */
const http = require("http"), fs = require("fs"), path = require("path");
const { handle, db, KEY, MODEL } = require("./handler");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const MIME = {".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".svg":"image/svg+xml",".png":"image/png"};
const PUBLIC = /^(\/|\/index\.html|\/(css|js)\/[\w.-]+)$/; // nothing else is served

http.createServer(async (req, res) => {
  try {
    if (await handle(req, res)) return;
    const url = new URL(req.url, "http://x");
    if (req.method === "GET" && PUBLIC.test(url.pathname)) {
      const file = path.join(PUBLIC_DIR, url.pathname === "/" ? "index.html" : url.pathname);
      return fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404); return res.end("Not found"); }
        res.writeHead(200, {"Content-Type": MIME[path.extname(file)] || "application/octet-stream"});
        res.end(buf);
      });
    }
    res.writeHead(404); res.end("Not found");
  } catch (e) { console.error(e); if (!res.headersSent) res.writeHead(500); res.end("Server error"); }
}).listen(PORT, () => console.log("Grounded on port " + PORT + " (database " + db.url.replace(/\?.*/, "") + ")" + (KEY ? " (AI photo check ON, " + MODEL + ")" : " (no ANTHROPIC_API_KEY: demo photo check)")));
