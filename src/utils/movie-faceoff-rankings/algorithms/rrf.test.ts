import { describe, expect, it } from 'vitest';
import {
    buildReplayFromVotes,
    rankedIds,
    stubAlgorithm,
} from '../../../test/fixtures/movie-faceoff';
import { MovieFaceoffRankingAlgorithm } from '../types';
import { rrfRankingAlgorithm } from './rrf';

const RRF_K = 60;

describe('rrfRankingAlgorithm (Weighted Consensus)', () => {
    it('is labeled "Weighted Consensus" and marked as aggregate', () => {
        expect(rrfRankingAlgorithm.id).toBe('rrf');
        expect(rrfRankingAlgorithm.label).toBe('Weighted Consensus');
        expect(rrfRankingAlgorithm.isAggregate).toBe(true);
    });

    it('returns an empty list when no primary algorithms are supplied', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(rrfRankingAlgorithm.rank(state, [])).toEqual([]);
    });

    it('filters out other aggregates and itself from its inputs', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primary = stubAlgorithm('elo', [1, 2], state);
        const otherAggregate: MovieFaceoffRankingAlgorithm = {
            id: 'trimmed-mean',
            label: 'fake',
            description: '',
            isAggregate: true,
            rank: () => {
                throw new Error('aggregates should not call other aggregates');
            },
            formatMetric: () => '',
        };
        const ranked = rrfRankingAlgorithm.rank(state, [
            primary,
            otherAggregate,
            rrfRankingAlgorithm,
        ]);
        expect(ranked.map((m) => m.id)).toEqual([1, 2]);
    });

    it('computes RRF score as sum of 1 / (K + rank) across primaries', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        // Two primaries, both rank [1, 2]. rank-of-1 is index 0 → position 1, rank-of-2 is index 1 → position 2.
        const primaries = [
            stubAlgorithm('a', [1, 2], state),
            stubAlgorithm('b', [1, 2], state),
        ];
        const ranked = rrfRankingAlgorithm.rank(state, primaries);
        const movie1 = ranked.find((m) => m.id === 1);
        const movie2 = ranked.find((m) => m.id === 2);
        expect(movie1?.score).toBeCloseTo(2 * (1 / (RRF_K + 1)), 10);
        expect(movie2?.score).toBeCloseTo(2 * (1 / (RRF_K + 2)), 10);
    });

    it('rewards top ranks more than bottom ranks', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primaries = [stubAlgorithm('a', [1, 2, 3], state)];
        const ranked = rrfRankingAlgorithm.rank(state, primaries);
        const movie1 = ranked.find((m) => m.id === 1)!;
        const movie3 = ranked.find((m) => m.id === 3)!;
        const gapTop = (movie1.score ?? 0) - (ranked.find((m) => m.id === 2)?.score ?? 0);
        const gapBottom =
            (ranked.find((m) => m.id === 2)?.score ?? 0) - (movie3.score ?? 0);
        expect(gapTop).toBeGreaterThan(gapBottom);
    });

    it('produces consensus ordering when primaries disagree', () => {
        // Two primaries rank [1, 2, 3]; one primary ranks [3, 2, 1]. RRF should still put 1 on top.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2, 3], state),
            stubAlgorithm('c', [3, 2, 1], state), // outlier
        ];
        expect(rankedIds(state, rrfRankingAlgorithm, primaries)).toEqual([1, 2, 3]);
    });

    it('formatMetric scales by 1000 for readability', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [stubAlgorithm('a', [1, 2], state)];
        const [top] = rrfRankingAlgorithm.rank(state, primaries);
        // score = 1/61 ≈ 0.0164. Scaled * 1000 = 16.4
        expect(rrfRankingAlgorithm.formatMetric(top)).toBe('16.4');
    });
});
