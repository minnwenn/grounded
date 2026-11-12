/* Vercel serverless function: every /api/* request lands here (the file name is a catch-all). */
const { handle } = require("../handler");

module.exports = async (req, res) => {
  if (!(await handle(req, res))) { res.statusCode = 404; res.end("Not found"); }
};
