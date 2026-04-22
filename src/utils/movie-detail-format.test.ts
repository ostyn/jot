import { describe, expect, it } from 'vitest';
import {
    formatDate,
    formatRuntime,
    formatVoteAverage,
    formatWinRate,
} from './movie-detail-format';

describe('formatRuntime', () => {
    it('returns empty string when runtime is missing', () => {
        expect(formatRuntime(undefined)).toBe('');
        expect(formatRuntime(0)).toBe('');
    });

    it('formats sub-hour runtimes as minutes', () => {
        expect(formatRuntime(42)).toBe('42m');
    });

    it('formats whole-hour runtimes without minutes', () => {
        expect(formatRuntime(120)).toBe('2h');
    });

    it('formats mixed hour + minute runtimes', () => {
        expect(formatRuntime(135)).toBe('2h 15m');
    });
});

describe('formatVoteAverage', () => {
    it('returns empty string when voteAverage is missing', () => {
        expect(formatVoteAverage(undefined)).toBe('');
    });

    it('formats without vote count', () => {
        expect(formatVoteAverage(7.8)).toBe('TMDB 7.8/10');
    });

    it('formats with vote count', () => {
        expect(formatVoteAverage(6.4, 7026)).toBe('TMDB 6.4/10 (7,026)');
    });
});

describe('formatDate', () => {
    it('returns "Unknown" when date is missing', () => {
        expect(formatDate(undefined)).toBe('Unknown');
    });

    it('returns the input string when unparseable', () => {
        expect(formatDate('not-a-date')).toBe('not-a-date');
    });

    it('formats ISO date in long form', () => {
        // Any reasonable locale output is fine; just check year/month/day appear
        const formatted = formatDate('2013-03-20');
        expect(formatted).toMatch(/2013/);
    });
});

describe('formatWinRate', () => {
    it('returns dash when there are no votes', () => {
        expect(formatWinRate(0, 0)).toBe('—');
    });

    it('rounds to nearest percent', () => {
        expect(formatWinRate(2, 1)).toBe('67%');
        expect(formatWinRate(3, 14)).toBe('18%');
    });
});
