import { describe, expect, it } from 'vitest';
import {
    buildReplayFromVotes,
    rankedIds,
    stubAlgorithm,
} from '../../../test/fixtures/movie-faceoff';
import { MovieFaceoffRankingAlgorithm } from '../types';
import { bordaRankingAlgorithm } from './borda';

describe('bordaRankingAlgorithm', () => {
    it('is labeled "Borda Count" and marked as aggregate', () => {
        expect(bordaRankingAlgorithm.id).toBe('borda');
        expect(bordaRankingAlgorithm.label).toBe('Borda Count');
        expect(bordaRankingAlgorithm.isAggregate).toBe(true);
    });

    it('returns an empty list when no primary algorithms are supplied', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(bordaRankingAlgorithm.rank(state, [])).toEqual([]);
    });

    it('filters out other aggregates and itself from its inputs', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primary = stubAlgorithm('elo', [1, 2], state);
        const otherAggregate: MovieFaceoffRankingAlgorithm = {
            id: 'rrf',
            label: 'fake',
            description: '',
            isAggregate: true,
            rank: () => {
                throw new Error('aggregates should not call other aggregates');
            },
            formatMetric: () => '',
        };
        const ranked = bordaRankingAlgorithm.rank(state, [
            primary,
            otherAggregate,
            bordaRankingAlgorithm,
        ]);
        expect(ranked.map((m) => m.id)).toEqual([1, 2]);
    });

    it('awards (N − 1 − position) points per algorithm', () => {
        // Single algorithm ranking [1, 2, 3] → points 2, 1, 0.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primaries = [stubAlgorithm('a', [1, 2, 3], state)];
        const ranked = bordaRankingAlgorithm.rank(state, primaries);
        expect(ranked.find((m) => m.id === 1)?.score).toBe(2);
        expect(ranked.find((m) => m.id === 2)?.score).toBe(1);
        expect(ranked.find((m) => m.id === 3)?.score).toBe(0);
    });

    it('weights every position equally (linear, not top-biased)', () => {
        // Single 4-movie ranking → points 3, 2, 1, 0. Gaps between adjacent
        // ranks should all be equal (Borda is linear). RRF would have shrinking gaps.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
            [3, 4],
        ]);
        const primaries = [stubAlgorithm('a', [1, 2, 3, 4], state)];
        const ranked = bordaRankingAlgorithm.rank(state, primaries);
        const scores = [1, 2, 3, 4].map(
            (id) => ranked.find((m) => m.id === id)?.score ?? 0
        );
        expect(scores[0] - scores[1]).toBe(1);
        expect(scores[1] - scores[2]).toBe(1);
        expect(scores[2] - scores[3]).toBe(1);
    });

    it('sums points across multiple algorithms', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        // Two primaries: [1, 2, 3] and [2, 1, 3]
        // 1: 2 + 1 = 3, 2: 1 + 2 = 3, 3: 0 + 0 = 0
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [2, 1, 3], state),
        ];
        const ranked = bordaRankingAlgorithm.rank(state, primaries);
        expect(ranked.find((m) => m.id === 1)?.score).toBe(3);
        expect(ranked.find((m) => m.id === 2)?.score).toBe(3);
        expect(ranked.find((m) => m.id === 3)?.score).toBe(0);
    });

    it('produces consensus ordering when primaries disagree', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2, 3], state),
            stubAlgorithm('c', [3, 2, 1], state),
        ];
        expect(rankedIds(state, bordaRankingAlgorithm, primaries)).toEqual([1, 2, 3]);
    });

    it('formatMetric reports raw points', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [stubAlgorithm('a', [1, 2], state)];
        const [top] = bordaRankingAlgorithm.rank(state, primaries);
        expect(bordaRankingAlgorithm.formatMetric(top)).toBe('1 pts');
    });
});
