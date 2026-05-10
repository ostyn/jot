import { describe, expect, it } from 'vitest';
import { Entry } from '../interfaces/entry.interface';
import { StatsActivityEntry } from '../interfaces/stats.interface';
import {
    getActivityFrequencyMetrics,
    isReminderDue,
} from './activity-frequency';

const NOW = new Date('2026-05-10T12:00:00Z');

function makeStat(dates: string[]): StatsActivityEntry {
    // mirror accumulateStatsFromEntries: dates[0] is newest (entries are loaded newest-first)
    const sorted = [...dates].sort().reverse();
    return {
        count: sorted.length,
        dates: sorted.map((d) => ({ date: d, entry: {} as Entry })),
    };
}

describe('getActivityFrequencyMetrics', () => {
    it('handles missing stat (never logged)', () => {
        const m = getActivityFrequencyMetrics(undefined, NOW);
        expect(m).toEqual({
            totalLogs: 0,
            daysSinceLast: null,
            avgDaysBetween: null,
            canAutoCadence: false,
        });
    });

    it('handles single log: daysSinceLast set, avgDaysBetween null, canAutoCadence false', () => {
        const stat = makeStat(['2026-05-08']);
        const m = getActivityFrequencyMetrics(stat, NOW);
        expect(m.totalLogs).toBe(1);
        expect(m.daysSinceLast).toBe(2);
        expect(m.avgDaysBetween).toBeNull();
        expect(m.canAutoCadence).toBe(false);
    });

    it('handles two logs: avgDaysBetween computed, canAutoCadence still false', () => {
        const stat = makeStat(['2026-05-04', '2026-05-08']);
        const m = getActivityFrequencyMetrics(stat, NOW);
        expect(m.totalLogs).toBe(2);
        expect(m.daysSinceLast).toBe(2);
        expect(m.avgDaysBetween).toBe(4);
        expect(m.canAutoCadence).toBe(false);
    });

    it('flips canAutoCadence true at 3+ logs', () => {
        const stat = makeStat(['2026-05-01', '2026-05-04', '2026-05-08']);
        const m = getActivityFrequencyMetrics(stat, NOW);
        expect(m.totalLogs).toBe(3);
        expect(m.daysSinceLast).toBe(2);
        expect(m.avgDaysBetween).toBe(4); // span 7 / (3-1) = 3.5 → 4
        expect(m.canAutoCadence).toBe(true);
    });

    it('rounds avg to nearest int with floor of 1', () => {
        // 3 logs spanning 1 day → avg 0.5 → floored to 1
        const stat = makeStat(['2026-05-08', '2026-05-09', '2026-05-09']);
        const m = getActivityFrequencyMetrics(stat, NOW);
        expect(m.avgDaysBetween).toBe(1);
    });

    it('clamps daysSinceLast to 0 when last log is today', () => {
        const stat = makeStat(['2026-05-10']);
        const m = getActivityFrequencyMetrics(stat, NOW);
        expect(m.daysSinceLast).toBe(0);
    });
});

describe('isReminderDue', () => {
    const metrics = {
        totalLogs: 5,
        daysSinceLast: 6,
        avgDaysBetween: 4,
        canAutoCadence: true,
    };

    it('false when reminder is undefined', () => {
        expect(isReminderDue(undefined, metrics, NOW)).toBe(false);
    });

    it('false when reminder is disabled', () => {
        expect(
            isReminderDue(
                { enabled: false, intervalDaysOverride: null },
                metrics,
                NOW
            )
        ).toBe(false);
    });

    it('false when no effective interval (no avg, no override)', () => {
        expect(
            isReminderDue(
                { enabled: true, intervalDaysOverride: null },
                { ...metrics, avgDaysBetween: null },
                NOW
            )
        ).toBe(false);
    });

    it('true when daysSinceLast >= interval', () => {
        expect(
            isReminderDue(
                { enabled: true, intervalDaysOverride: null },
                metrics,
                NOW
            )
        ).toBe(true);
    });

    it('false when daysSinceLast < interval', () => {
        expect(
            isReminderDue(
                { enabled: true, intervalDaysOverride: null },
                { ...metrics, daysSinceLast: 3 },
                NOW
            )
        ).toBe(false);
    });

    it('true when never logged but override set (cold-start)', () => {
        expect(
            isReminderDue(
                { enabled: true, intervalDaysOverride: 3 },
                {
                    totalLogs: 0,
                    daysSinceLast: null,
                    avgDaysBetween: null,
                    canAutoCadence: false,
                },
                NOW
            )
        ).toBe(true);
    });

    it('false when dismissed today', () => {
        expect(
            isReminderDue(
                {
                    enabled: true,
                    intervalDaysOverride: null,
                    lastDismissed: '2026-05-10',
                },
                metrics,
                NOW
            )
        ).toBe(false);
    });

    it('true when dismissed yesterday (snooze expired)', () => {
        expect(
            isReminderDue(
                {
                    enabled: true,
                    intervalDaysOverride: null,
                    lastDismissed: '2026-05-09',
                },
                metrics,
                NOW
            )
        ).toBe(true);
    });

    it('respects user override even when avg disagrees', () => {
        // avg says due (6 >= 4), but override says every 10 days
        expect(
            isReminderDue(
                { enabled: true, intervalDaysOverride: 10 },
                metrics,
                NOW
            )
        ).toBe(false);
    });
});
