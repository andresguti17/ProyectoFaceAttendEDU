import { runRiskAlertPass } from '../../application/attendanceAlerts/riskReport';
import type { AlertDeps } from '../../application/attendanceAlerts/deps';

const DEFAULT_HOUR = 7;

/** Hour of the day (0-23, server local time) the daily at-risk pass runs at. */
export function riskHourFromEnv(env: NodeJS.ProcessEnv = process.env): number {
  const hour = Number.parseInt((env.RISK_ALERT_HOUR ?? '').trim(), 10);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_HOUR;
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
 * Runs the at-risk pass every day at `hour`. A failing pass is logged and tomorrow's still runs;
 * running twice in a day is harmless (the pass is idempotent).
 */
export function startRiskScheduler(deps: AlertDeps, hour: number = riskHourFromEnv()): RiskScheduler {
  let timer: NodeJS.Timeout | undefined;
  let stopped = false;

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(async () => {
      try {
        await runRiskAlertPass(deps);
      } catch (err) {
        deps.logger.warn('daily at-risk pass failed', { error: String(err) });
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
