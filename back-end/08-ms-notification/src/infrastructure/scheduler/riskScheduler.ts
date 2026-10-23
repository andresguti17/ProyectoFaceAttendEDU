import { runRiskAlertPass } from '../../application/attendanceAlerts/riskReport';
import { runDailySummary, runWeeklyReport } from '../../application/attendanceAlerts/periodReport';
import type { AlertDeps, AlertLogger } from '../../application/attendanceAlerts/deps';

const DEFAULT_RISK_HOUR = 7;
const DEFAULT_SUMMARY_HOUR = 19;
/** `Date#getDay`: Monday. The weekly report covers the seven days before it. */
const WEEKLY_REPORT_DAY = 1;

function hourFrom(raw: string | undefined, fallback: number): number {
  const hour = Number.parseInt((raw ?? '').trim(), 10);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : fallback;
}

/** Hour of the day (0-23, server local time) the daily at-risk pass and the weekly report run at. */
export function riskHourFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  return hourFrom(env.RISK_ALERT_HOUR, DEFAULT_RISK_HOUR);
}

/** Hour the daily summary runs at: the evening, once the day's classes are closed. */
export function summaryHourFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  return hourFrom(env.DAILY_SUMMARY_HOUR, DEFAULT_SUMMARY_HOUR);
}

/** Milliseconds from `now` to the next occurrence of `hour`:00 (tomorrow when it already passed). */
export function msUntilNextRun(now: Date, hour: number): number {
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export interface RiskScheduler {
  stop(): void;
}

/**
 * Runs `job` every day at `hour`. A failing run is logged and tomorrow's still happens; running
 * twice in a day is harmless because every job is idempotent.
 */
export function startDailyJob(name: string, logger: AlertLogger, hour: number, job: (now: Date) => Promise<unknown>): RiskScheduler {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(async () => {
      try {
        await job(new Date());
      } catch (err) {
        logger.warn('daily job failed', { job: name, error: String(err) });
      }
      schedule();
    }, msUntilNextRun(new Date(), hour));
    timer.unref();
  };
  schedule();

  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}

/** Starts the three scheduled jobs: at-risk pass, daily summary and (on Mondays) weekly report. */
export function startAttendanceSchedulers(deps: AlertDeps, env: NodeJS.ProcessEnv = process.env): RiskScheduler {
  const riskHour = riskHourFromEnv(env);
  const jobs = [
    startDailyJob('at-risk', deps.logger, riskHour, () => runRiskAlertPass(deps)),
    startDailyJob('daily-summary', deps.logger, summaryHourFromEnv(env), (now) => runDailySummary(deps, now)),
    startDailyJob('weekly-report', deps.logger, riskHour, async (now) => {
      if (now.getDay() === WEEKLY_REPORT_DAY) await runWeeklyReport(deps, now);
    }),
  ];
  return { stop: () => jobs.forEach((job) => job.stop()) };
}
