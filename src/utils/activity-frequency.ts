import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { ActivityReminderConfig } from '../interfaces/activity.interface';
import { StatsActivityEntry } from '../interfaces/stats.interface';

export interface ActivityFrequencyMetrics {
    totalLogs: number;
    daysSinceLast: number | null;
    avgDaysBetween: number | null;
    canAutoCadence: boolean;
}

export function getActivityFrequencyMetrics(
    stat: StatsActivityEntry | undefined,
    now: Date = new Date()
): ActivityFrequencyMetrics {
    const totalLogs = stat?.dates.length ?? 0;
    if (!stat || totalLogs === 0) {
        return {
            totalLogs: 0,
            daysSinceLast: null,
            avgDaysBetween: null,
            canAutoCadence: false,
        };
    }
    const lastDate = parseISO(stat.dates[0].date);
    // guard against future-dated entries
    const daysSinceLast = Math.max(0, differenceInCalendarDays(now, lastDate));
    let avgDaysBetween: number | null = null;
    if (totalLogs >= 2) {
        const firstDate = parseISO(stat.dates[totalLogs - 1].date);
        const span = differenceInCalendarDays(lastDate, firstDate);
        avgDaysBetween = Math.max(1, Math.round(span / (totalLogs - 1)));
    }
    return {
        totalLogs,
        daysSinceLast,
        avgDaysBetween,
        canAutoCadence: totalLogs >= 3,
    };
}

export interface ReminderEvaluation {
    interval: number;
    // positive = overdue by N days, 0 = due today, negative = N days until due
    daysOverdue: number;
    isOverdue: boolean;
    dismissedToday: boolean;
}

// Returns null when the reminder can't be evaluated (no interval available
// because there's neither a manual override nor enough history for an average).
export function getReminderStatus(
    reminder: ActivityReminderConfig,
    metrics: ActivityFrequencyMetrics,
    now: Date = new Date()
): ReminderEvaluation | null {
    const interval = reminder.intervalDaysOverride ?? metrics.avgDaysBetween;
    if (interval == null) return null;
    const daysOverdue =
        metrics.daysSinceLast == null
            ? 0
            : metrics.daysSinceLast - interval;
    return {
        interval,
        daysOverdue,
        isOverdue: metrics.daysSinceLast == null || daysOverdue >= 0,
        dismissedToday: reminder.lastDismissed === format(now, 'yyyy-MM-dd'),
    };
}

export interface CadenceRegularity {
    avgDaysBetween: number;
    cvDaysBetween: number;
    isStrong: boolean;
}

const MIN_LOGS_FOR_SUGGESTION = 4;
const MAX_CV_FOR_SUGGESTION = 0.6;
// Only consider logs from this many days back when detecting a cadence, so
// habits the user has tapered off don't keep getting re-suggested.
const LOOKBACK_DAYS_FOR_SUGGESTION = 365;

// Coefficient-of-variation analysis over inter-log gaps. We surface a habit as
// "strong" only when there are enough recent samples, the gaps cluster tightly
// around the mean, and the cadence rounds to >= 2 days (daily/sub-daily
// activities are habits the user does without prompting).
export function getCadenceRegularity(
    stat: StatsActivityEntry | undefined,
    now: Date = new Date()
): CadenceRegularity | null {
    if (!stat) return null;
    const recentDates = stat.dates.filter(
        (d) =>
            differenceInCalendarDays(now, parseISO(d.date)) <=
            LOOKBACK_DAYS_FOR_SUGGESTION
    );
    if (recentDates.length < MIN_LOGS_FOR_SUGGESTION) return null;
    const gaps: number[] = [];
    for (let i = 0; i < recentDates.length - 1; i++) {
        const newer = parseISO(recentDates[i].date);
        const older = parseISO(recentDates[i + 1].date);
        gaps.push(Math.max(0, differenceInCalendarDays(newer, older)));
    }
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (mean < 1.5) return null;
    const variance =
        gaps.reduce((acc, g) => acc + (g - mean) ** 2, 0) / gaps.length;
    const cv = Math.sqrt(variance) / mean;
    return {
        avgDaysBetween: Math.round(mean),
        cvDaysBetween: cv,
        isStrong: cv <= MAX_CV_FOR_SUGGESTION,
    };
}
