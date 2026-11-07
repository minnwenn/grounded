/* Calendar days on the app's clock. A "day" is a whole number of days since 1970-01-01 in APP_TZ,
 * so it rolls over at local midnight for the school (default Singapore), not at UTC midnight. */
const TZ = process.env.APP_TZ || "Asia/Singapore";
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

const dateToDay = s => Math.floor(Date.parse(s + "T00:00:00Z") / 864e5);
const dayToDate = d => new Date(d * 864e5).toISOString().slice(0, 10);
const realDay = () => dateToDay(fmt.format(new Date()));

module.exports = { TZ, dateToDay, dayToDate, realDay };
