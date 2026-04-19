import { describe, expect, it } from 'vitest';
import {
    buildReplayFromVotes,
    rankedIds,
    stubAlgorithm,
} from '../../../test/fixtures/movie-faceoff';
import { MovieFaceoffRankingAlgorithm } from '../types';
import { trimmedMeanRankingAlgorithm } from './trimmed-mean';

describe('trimmedMeanRankingAlgorithm (Olympic Score)', () => {
    it('is labeled "Olympic Score" and marked as aggregate', () => {
        expect(trimmedMeanRankingAlgorithm.id).toBe('trimmed-mean');
        expect(trimmedMeanRankingAlgorithm.label).toBe('Olympic Score');
        expect(trimmedMeanRankingAlgorithm.isAggregate).toBe(true);
    });

    it('returns an empty list when no primary algorithms are supplied', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(trimmedMeanRankingAlgorithm.rank(state, [])).toEqual([]);
    });

    it('filters out other aggregates from its inputs (does not consume itself or RRF)', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primaryOrder = [1, 2];
        const primary = stubAlgorithm('elo', primaryOrder, state);
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
        const ranked = trimmedMeanRankingAlgorithm.rank(state, [
            primary,
            otherAggregate,
            trimmedMeanRankingAlgorithm,
        ]);
        expect(ranked.map((m) => m.id)).toEqual(primaryOrder);
    });

    it('averages all ranks when fewer than four algorithms are provided (no trimming)', () => {
        // 3 primaries disagree about movie order so the no-trim path is distinguishable from a symmetric trim.
        // Movie 1 ranks: [1, 1, 2] → mean = 4/3 ≈ 1.333
        // Movie 2 ranks: [2, 2, 1] → mean = 5/3 ≈ 1.667
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [
            stubAlgorithm('a', [1, 2], state),
            stubAlgorithm('b', [1, 2], state),
            stubAlgorithm('c', [2, 1], state),
        ];
        const ranked = trimmedMeanRankingAlgorithm.rank(state, primaries);
        expect(ranked.find((m) => m.id === 1)?.score).toBeCloseTo(4 / 3, 10);
        expect(ranked.find((m) => m.id === 2)?.score).toBeCloseTo(5 / 3, 10);
    });

    it('drops best and worst rank when four or more algorithms are provided', () => {
        // 3 primaries rank [1, 2]; one outlier flips to [2, 1].
        // Movie 1: ranks [1, 1, 1, 2] sorted → drop first (1) and last (2) → mean([1, 1]) = 1
        // Movie 2: ranks [2, 2, 2, 1] sorted → drop first (1) and last (2) → mean([2, 2]) = 2
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [
            stubAlgorithm('a', [1, 2], state),
            stubAlgorithm('b', [1, 2], state),
            stubAlgorithm('c', [1, 2], state),
            stubAlgorithm('d', [2, 1], state), // outlier — gets trimmed away
        ];
        const ranked = trimmedMeanRankingAlgorithm.rank(state, primaries);
        expect(ranked.find((m) => m.id === 1)?.score).toBeCloseTo(1, 10);
        expect(ranked.find((m) => m.id === 2)?.score).toBeCloseTo(2, 10);
    });

    it('sorts by ascending mean rank (lower is better)', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [stubAlgorithm('a', [1, 2], state)];
        const ranked = trimmedMeanRankingAlgorithm.rank(state, primaries);
        expect(ranked.map((m) => m.id)).toEqual([1, 2]);
    });

    it('formatMetric shows "#N.N avg" with one decimal place', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [stubAlgorithm('a', [1, 2], state)];
        const [first] = trimmedMeanRankingAlgorithm.rank(state, primaries);
        expect(trimmedMeanRankingAlgorithm.formatMetric(first)).toBe('#1.0 avg');
    });

    it('formatMetric returns "Unranked" for infinite or missing scores', () => {
        expect(
            trimmedMeanRankingAlgorithm.formatMetric({
                id: 1,
                title: 'T',
                createdAt: '',
                updatedAt: '',
                rating: 1500,
                winCount: 0,
                lossCount: 0,
                score: Number.POSITIVE_INFINITY,
            })
        ).toBe('Unranked');
    });

    it('uses rankedIds helper cleanly', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const primaries = [stubAlgorithm('a', [1, 2], state)];
        expect(rankedIds(state, trimmedMeanRankingAlgorithm, primaries)).toEqual([1, 2]);
    });
});
