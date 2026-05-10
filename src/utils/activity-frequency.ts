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

export function isReminderDue(
    reminder: ActivityReminderConfig | undefined,
    metrics: ActivityFrequencyMetrics,
    now: Date = new Date()
): boolean {
    if (!reminder?.enabled) return false;
    const interval = reminder.intervalDaysOverride ?? metrics.avgDaysBetween;
    if (interval == null) return false;
    if (reminder.lastDismissed === format(now, 'yyyy-MM-dd')) return false;
    if (metrics.daysSinceLast == null) return true;
    return metrics.daysSinceLast >= interval;
}
