// When each of Alfred's GitHub workflows runs. The clock Worker wakes at the
// top of every hour and starts whichever workflows are due that hour.
//
// Hours are UTC, as Cloudflare's cron is. South Africa has no daylight
// saving, so SAST is always UTC+2.
//
// `inputs` are passed to the workflow's workflow_dispatch trigger, which must
// declare each one: GitHub refuses inputs a workflow doesn't declare.

export const SCHEDULE = [
  // 02:00 SAST on Mondays
  { workflow: 'spotify-data-update.yml', hours: [0], weekdays: [1] },
  // 04:00 SAST, so last night's episodes count by morning
  { workflow: 'update-watching.yml', hours: [2] },
  // 08:00 SAST. Sponsors come rarely; once a day is plenty.
  { workflow: 'update-sponsors.yml', hours: [6] },
  // 10:00 SAST, then 14:00 and 18:00 as backups. `scheduled` makes the
  // backups skip once the day's stats are in, as a manual run never does.
  { workflow: 'update-coffee-stats.yml', hours: [8, 12, 16], inputs: { scheduled: 'true' } },
  // 19:00 SAST, after the day's coffee runs
  { workflow: 'quiet-week.yml', hours: [17] },
];

// The jobs due at a scheduled time (ms since the epoch), judged by its UTC hour
// and weekday (0 is Sunday).
export function jobsDue(scheduledTime, schedule = SCHEDULE) {
  const at = new Date(scheduledTime);
  const hour = at.getUTCHours();
  const weekday = at.getUTCDay();
  return schedule.filter((job) => job.hours.includes(hour) && (!job.weekdays || job.weekdays.includes(weekday)));
}
