import { describe, expect, it } from 'vitest';
import { Entry } from '../interfaces/entry.interface';
import { StatsActivityEntry } from '../interfaces/stats.interface';
import {
    getActivityFrequencyMetrics,
    getCadenceRegularity,
    getReminderStatus,
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

    it('computes avgDaysBetween only from in-window logs', () => {
        // NOW = 2026-05-10. Lookback 365 → cutoff 2025-05-10.
        // Two old logs (out of window) + three recent biweekly logs.
        // avg comes from the recent three only.
        const stat = makeStat([
            '2024-01-01',
            '2024-06-01',
            '2026-04-12',
            '2026-04-26',
            '2026-05-10',
        ]);
        const m = getActivityFrequencyMetrics(stat, NOW);
        expect(m.totalLogs).toBe(5);
        expect(m.avgDaysBetween).toBe(14);
        expect(m.canAutoCadence).toBe(true);
    });

    it('returns null avg when fewer than 2 logs are in-window, even if all-time has more', () => {
        // 3 old + 1 recent → recentDates length 1 → avg null, canAutoCadence false
        const stat = makeStat([
            '2024-01-01',
            '2024-06-01',
            '2024-12-01',
            '2026-05-01',
        ]);
        const m = getActivityFrequencyMetrics(stat, NOW);
        expect(m.totalLogs).toBe(4);
        expect(m.avgDaysBetween).toBeNull();
        expect(m.canAutoCadence).toBe(false);
        // daysSinceLast still reflects the actual most recent log
        expect(m.daysSinceLast).toBe(9);
    });
});

describe('getReminderStatus', () => {
    const metrics = {
        totalLogs: 5,
        daysSinceLast: 6,
        avgDaysBetween: 4,
        canAutoCadence: true,
    };

    it('returns null when no interval can be derived', () => {
        expect(
            getReminderStatus(
                { enabled: true, intervalDaysOverride: null },
                { ...metrics, avgDaysBetween: null },
                NOW
            )
        ).toBeNull();
    });

    it('reports overdue when daysSinceLast > interval', () => {
        const status = getReminderStatus(
            { enabled: true, intervalDaysOverride: null },
            metrics,
            NOW
        );
        expect(status).toEqual({
            interval: 4,
            daysOverdue: 2,
            isOverdue: true,
            dismissedToday: false,
        });
    });

    it('reports due-today when daysSinceLast === interval', () => {
        const status = getReminderStatus(
            { enabled: true, intervalDaysOverride: null },
            { ...metrics, daysSinceLast: 4 },
            NOW
        );
        expect(status?.daysOverdue).toBe(0);
        expect(status?.isOverdue).toBe(true);
    });

    it('reports upcoming with negative daysOverdue when not yet due', () => {
        const status = getReminderStatus(
            { enabled: true, intervalDaysOverride: null },
            { ...metrics, daysSinceLast: 1 },
            NOW
        );
        expect(status?.daysOverdue).toBe(-3);
        expect(status?.isOverdue).toBe(false);
    });

    it('treats never-logged as overdue when override is set', () => {
        const status = getReminderStatus(
            { enabled: true, intervalDaysOverride: 3 },
            {
                totalLogs: 0,
                daysSinceLast: null,
                avgDaysBetween: null,
                canAutoCadence: false,
            },
            NOW
        );
        expect(status).toEqual({
            interval: 3,
            daysOverdue: 0,
            isOverdue: true,
            dismissedToday: false,
        });
    });

    it('flags dismissedToday when lastDismissed matches today', () => {
        const status = getReminderStatus(
            {
                enabled: true,
                intervalDaysOverride: null,
                lastDismissed: '2026-05-10',
            },
            metrics,
            NOW
        );
        expect(status?.dismissedToday).toBe(true);
    });

    it('does not flag dismissedToday when lastDismissed is yesterday', () => {
        const status = getReminderStatus(
            {
                enabled: true,
                intervalDaysOverride: null,
                lastDismissed: '2026-05-09',
            },
            metrics,
            NOW
        );
        expect(status?.dismissedToday).toBe(false);
    });

    it('honors override over computed avg', () => {
        const status = getReminderStatus(
            { enabled: true, intervalDaysOverride: 10 },
            metrics,
            NOW
        );
        expect(status?.interval).toBe(10);
        expect(status?.isOverdue).toBe(false);
    });
});

describe('getCadenceRegularity', () => {
    it('returns null when no stat is provided', () => {
        expect(getCadenceRegularity(undefined, NOW)).toBeNull();
    });

    it('returns null when fewer than MIN_LOGS_FOR_SUGGESTION logs', () => {
        // 3 logs is below the threshold
        const stat = makeStat(['2026-01-01', '2026-01-15', '2026-02-01']);
        expect(getCadenceRegularity(stat, NOW)).toBeNull();
    });

    it('flags a perfectly regular biweekly cadence as strong', () => {
        // 5 logs exactly 14 days apart → CV = 0 → strong
        const stat = makeStat([
            '2026-01-01',
            '2026-01-15',
            '2026-01-29',
            '2026-02-12',
            '2026-02-26',
        ]);
        const r = getCadenceRegularity(stat, NOW);
        expect(r).not.toBeNull();
        expect(r!.avgDaysBetween).toBe(14);
        expect(r!.cvDaysBetween).toBeCloseTo(0, 5);
        expect(r!.isStrong).toBe(true);
    });

    it('flags a noisy cadence as not strong', () => {
        // gaps: 1, 1, 100, 1 → mean 25.75, stdDev ≈ 42.9, CV ≈ 1.66
        const stat = makeStat([
            '2026-01-01',
            '2026-01-02',
            '2026-04-12',
            '2026-04-13',
            '2026-04-14',
        ]);
        const r = getCadenceRegularity(stat, NOW);
        expect(r).not.toBeNull();
        expect(r!.cvDaysBetween).toBeGreaterThan(1);
        expect(r!.isStrong).toBe(false);
    });

    it('returns null when mean gap is < 1 day (sub-daily)', () => {
        // 5 logs on the same day → mean gap 0 → excluded
        const stat = makeStat([
            '2026-05-10',
            '2026-05-10',
            '2026-05-10',
            '2026-05-10',
            '2026-05-10',
        ]);
        expect(getCadenceRegularity(stat, NOW)).toBeNull();
    });

    it('returns null for daily cadences (no reminder needed)', () => {
        const stat = makeStat([
            '2026-05-01',
            '2026-05-02',
            '2026-05-03',
            '2026-05-04',
            '2026-05-05',
        ]);
        expect(getCadenceRegularity(stat, NOW)).toBeNull();
    });

    it('ignores logs older than the lookback window', () => {
        // NOW is 2026-05-10. Lookback is 365 days → cutoff 2025-05-10.
        // Four logs from 2024 are out of window; only one recent log → not
        // enough to compute a cadence.
        const stat = makeStat([
            '2024-01-01',
            '2024-04-01',
            '2024-07-01',
            '2024-10-01',
            '2026-05-01',
        ]);
        expect(getCadenceRegularity(stat, NOW)).toBeNull();
    });

    it('uses only in-window logs when computing cadence', () => {
        // Two old (out of window) + four recent biweekly logs → cadence comes
        // from the recent four only.
        const stat = makeStat([
            '2024-01-01',
            '2024-06-01',
            '2026-04-04',
            '2026-04-18',
            '2026-05-02',
            '2026-05-10',
        ]);
        const r = getCadenceRegularity(stat, NOW);
        expect(r).not.toBeNull();
        expect(r!.avgDaysBetween).toBeLessThan(20);
        expect(r!.isStrong).toBe(true);
    });
});
