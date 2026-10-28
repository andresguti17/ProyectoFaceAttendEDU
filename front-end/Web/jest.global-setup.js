// Pins the timezone of every Jest worker. The app formats dates in the local zone and the
// snapshots (reports, history PDF) were recorded in Colombia time (UTC-5), so a runner in
// UTC (CI) rendered "15:00" where the snapshot has "10:00". A global setup runs before the
// workers are spawned, so they inherit it on every OS.
module.exports = async () => {
  process.env.TZ = "America/Bogota";
};
