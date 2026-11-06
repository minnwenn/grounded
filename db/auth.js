/* Password hashing with Node's built-in scrypt. Format: scrypt$<salt hex>$<hash hex> */
const crypto = require("crypto");
function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  return "scrypt$" + salt.toString("hex") + "$" + crypto.scryptSync(pw, salt, 64).toString("hex");
}
function verifyPassword(pw, stored) {
  const [, salt, hash] = String(stored).split("$");
  if (!salt || !hash) return false;
  const h = crypto.scryptSync(pw, Buffer.from(salt, "hex"), 64);
  const want = Buffer.from(hash, "hex");
  return h.length === want.length && crypto.timingSafeEqual(h, want);
}
module.exports = { hashPassword, verifyPassword };
