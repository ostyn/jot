import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, stubAlgorithm } from '../../test/fixtures/movie-faceoff';
import { computeAgreementLeaveOneOut } from './agreement-leave-one-out';

describe('computeAgreementLeaveOneOut', () => {
    it('reports the baseline and no contributions for fewer than 3 primaries', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const result = computeAgreementLeaveOneOut(state, [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2, 3], state),
        ]);
        expect(result.primaryCount).toBe(2);
        expect(result.baselineAgreement).toBe(1);
        expect(result.contributions).toEqual([]);
    });

    it('flags a dissenter (positive delta) above echoes (negative delta)', () => {
        // a, b agree; c is the exact reverse. Removing c should make the
        // remaining two unanimous (agreement 1.0); removing a or b leaves a
        // perfectly-split pair (agreement 0).
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const result = computeAgreementLeaveOneOut(state, [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2, 3], state),
            stubAlgorithm('c', [3, 2, 1], state),
        ]);

        // Baseline: each pair is 2-vs-1 → |2-1|/3 = 1/3.
        expect(result.baselineAgreement).toBeCloseTo(1 / 3, 6);

        // Sorted by delta descending — the dissenter c is first.
        expect(result.contributions.map((c) => c.id)).toEqual(['c', 'a', 'b']);

        const c = result.contributions[0];
        expect(c.agreementWithout).toBe(1);
        expect(c.delta).toBeCloseTo(2 / 3, 6);

        for (const echo of result.contributions.slice(1)) {
            expect(echo.agreementWithout).toBe(0);
            expect(echo.delta).toBeCloseTo(-1 / 3, 6);
        }
    });

    it('identifies the echo when one algorithm merely reinforces the majority', () => {
        // a, b, c all rank 1>2; d is the lone dissenter on that pair.
        // Removing d (dissenter) raises agreement; removing any of a/b/c
        // (echoes) lowers it.
        const state = buildReplayFromVotes([[1, 2]]);
        const result = computeAgreementLeaveOneOut(state, [
            stubAlgorithm('a', [1, 2], state),
            stubAlgorithm('b', [1, 2], state),
            stubAlgorithm('c', [1, 2], state),
            stubAlgorithm('d', [2, 1], state),
        ]);

        // Baseline on the single pair: 3-vs-1 → |3-1|/4 = 0.5.
        expect(result.baselineAgreement).toBeCloseTo(0.5, 6);

        const top = result.contributions[0];
        expect(top.id).toBe('d');
        expect(top.agreementWithout).toBe(1); // a, b, c unanimous
        expect(top.delta).toBeGreaterThan(0);

        // The three echoes each drop agreement to 2-vs-1 → 1/3.
        for (const echo of result.contributions.slice(1)) {
            expect(echo.agreementWithout).toBeCloseTo(1 / 3, 6);
            expect(echo.delta).toBeLessThan(0);
        }
    });

    it('ignores aggregate and informational algorithms', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const result = computeAgreementLeaveOneOut(state, [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2, 3], state),
            stubAlgorithm('c', [3, 2, 1], state),
            { ...stubAlgorithm('rrf', [1, 2, 3], state), isAggregate: true },
            {
                ...stubAlgorithm('alphabetical', [3, 2, 1], state),
                isInformational: true,
            },
        ]);

        expect(result.primaryCount).toBe(3);
        expect(result.contributions.map((c) => c.id).sort()).toEqual([
            'a',
            'b',
            'c',
        ]);
    });
});
