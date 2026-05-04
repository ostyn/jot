import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, stubAlgorithm } from '../../test/fixtures/movie-faceoff';
import {
    buildPairwiseDisagreement,
    getPairwiseDisagreement,
    pairDisagreement,
} from './pairwise-disagreement';

describe('buildPairwiseDisagreement', () => {
    it('returns empty matrix when no algorithms produce a ranking', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const matrix = buildPairwiseDisagreement(state, []);
        expect(matrix.n).toBe(0);
        expect(matrix.ids).toEqual([]);
        expect(matrix.d).toEqual(new Int32Array(0));
    });

    it('skips aggregates and informational algorithms', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primary = stubAlgorithm('a', [1, 2], state);
        const aggregate = {
            ...stubAlgorithm('rrf', [2, 1], state),
            isAggregate: true,
        };
        const informational = {
            ...stubAlgorithm('alphabetical', [2, 1], state),
            isInformational: true,
        };
        const matrix = buildPairwiseDisagreement(state, [
            primary,
            aggregate,
            informational,
        ]);
        const i1 = matrix.idIndex.get(1)!;
        const i2 = matrix.idIndex.get(2)!;
        // Only the primary contributes — aggregate and informational ignored.
        expect(matrix.d[i1 * matrix.n + i2]).toBe(1);
        expect(matrix.d[i2 * matrix.n + i1]).toBe(0);
    });

    it('counts each primary that ranks i above j', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2, 3], state),
            stubAlgorithm('c', [3, 1, 2], state),
        ];
        const matrix = buildPairwiseDisagreement(state, primaries);
        const i1 = matrix.idIndex.get(1)!;
        const i2 = matrix.idIndex.get(2)!;
        const i3 = matrix.idIndex.get(3)!;
        expect(matrix.d[i1 * matrix.n + i2]).toBe(3); // all three rank 1 > 2
        expect(matrix.d[i2 * matrix.n + i1]).toBe(0);
        expect(matrix.d[i3 * matrix.n + i1]).toBe(1); // only c ranks 3 > 1
        expect(matrix.d[i1 * matrix.n + i3]).toBe(2);
    });

    it('drops algorithms that did not rank both ids in the pair', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2], state), // missing 3
        ];
        const matrix = buildPairwiseDisagreement(state, primaries);
        const i1 = matrix.idIndex.get(1)!;
        const i3 = matrix.idIndex.get(3)!;
        // Only `a` ranked both 1 and 3; `b` is silent on the pair.
        expect(matrix.d[i1 * matrix.n + i3]).toBe(1);
        expect(matrix.d[i3 * matrix.n + i1]).toBe(0);
    });
});

describe('pairDisagreement', () => {
    it('returns 0 when no algorithm has an opinion (cold-start pair)', () => {
        // Two algorithms with disjoint coverage — they never rank a pair
        // jointly, so kPerPair is 0 for every cross-pair.
        const state = buildReplayFromVotes([
            [1, 2],
            [3, 4],
        ]);
        const primaries = [
            stubAlgorithm('a', [1, 2], state),
            stubAlgorithm('b', [3, 4], state),
        ];
        const matrix = buildPairwiseDisagreement(state, primaries);
        const i1 = matrix.idIndex.get(1)!;
        const i3 = matrix.idIndex.get(3)!;
        expect(pairDisagreement(matrix, i1, i3)).toBe(0);
    });

    it('returns 0 for out-of-range or self pairs (defensive)', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const matrix = buildPairwiseDisagreement(state, [
            stubAlgorithm('a', [1, 2], state),
        ]);
        expect(pairDisagreement(matrix, -1, 0)).toBe(0);
        expect(pairDisagreement(matrix, 0, 99)).toBe(0);
        expect(pairDisagreement(matrix, 0, 0)).toBe(0);
    });

    it('returns 0 when all algorithms unanimously agree', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [
            stubAlgorithm('a', [1, 2], state),
            stubAlgorithm('b', [1, 2], state),
        ];
        const matrix = buildPairwiseDisagreement(state, primaries);
        const i1 = matrix.idIndex.get(1)!;
        const i2 = matrix.idIndex.get(2)!;
        expect(pairDisagreement(matrix, i1, i2)).toBe(0);
    });

    it('peaks near 1 when algorithms split evenly', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        // 4-way perfect split: 2 algorithms put 1 above 2, 2 the other way.
        const primaries = [
            stubAlgorithm('a', [1, 2], state),
            stubAlgorithm('b', [1, 2], state),
            stubAlgorithm('c', [2, 1], state),
            stubAlgorithm('d', [2, 1], state),
        ];
        const matrix = buildPairwiseDisagreement(state, primaries);
        const i1 = matrix.idIndex.get(1)!;
        const i2 = matrix.idIndex.get(2)!;
        const score = pairDisagreement(matrix, i1, i2);
        // split=1, saturation = 4/(4+2) = 2/3 → 0.666...
        expect(score).toBeCloseTo(2 / 3, 6);
    });

    it('saturation dampens single-algorithm pairs vs many-algorithm pairs', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const onePrimary = [stubAlgorithm('a', [1, 2], state)];
        const manyPrimaries = Array.from({ length: 10 }, (_, i) =>
            stubAlgorithm(String.fromCharCode(97 + i), [1, 2], state)
        );

        const sparse = buildPairwiseDisagreement(state, onePrimary);
        const dense = buildPairwiseDisagreement(state, manyPrimaries);
        // Both are unanimous (split=0), so pairDisagreement is 0 for both.
        // Verify the saturation factor on a mid-split case instead:
        const mixed = [
            stubAlgorithm('a', [1, 2], state),
            stubAlgorithm('b', [2, 1], state),
        ];
        const mixedMany = [
            ...mixed,
            ...Array.from({ length: 8 }, (_, i) => {
                const id = String.fromCharCode(99 + i);
                return stubAlgorithm(id, i < 4 ? [1, 2] : [2, 1], state);
            }),
        ];
        const small = buildPairwiseDisagreement(state, mixed);
        const big = buildPairwiseDisagreement(state, mixedMany);
        const sI1 = small.idIndex.get(1)!;
        const sI2 = small.idIndex.get(2)!;
        const bI1 = big.idIndex.get(1)!;
        const bI2 = big.idIndex.get(2)!;
        // small: k=2, split=1, saturation=2/4=0.5
        // big: k=10, split=1, saturation=10/12≈0.833
        expect(pairDisagreement(small, sI1, sI2)).toBeCloseTo(0.5, 6);
        expect(pairDisagreement(big, bI1, bI2)).toBeCloseTo(10 / 12, 6);
        // Touch unused vars to satisfy lint when the variants weren't used directly.
        void sparse;
        void dense;
    });
});

describe('getPairwiseDisagreement (memoized)', () => {
    it('returns the same reference on repeated calls with the same inputs', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [stubAlgorithm('a', [1, 2], state)];
        const first = getPairwiseDisagreement(state, primaries);
        const second = getPairwiseDisagreement(state, primaries);
        expect(second).toBe(first);
    });

    it('rebuilds when the replay reference changes', () => {
        const stateA = buildReplayFromVotes([[1, 2]]);
        const stateB = buildReplayFromVotes([[1, 2]]);
        const primaries = [stubAlgorithm('a', [1, 2], stateA)];
        const a = getPairwiseDisagreement(stateA, primaries);
        const b = getPairwiseDisagreement(stateB, primaries);
        expect(b).not.toBe(a);
    });
});
