import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { winsRankingAlgorithm } from './wins';

describe('winsRankingAlgorithm', () => {
    it('is labeled "Win Rate" with id "wins"', () => {
        expect(winsRankingAlgorithm.id).toBe('wins');
        expect(winsRankingAlgorithm.label).toBe('Win Rate');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(winsRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('ranks a perfect winner above a perfect loser', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(rankedIds(state, winsRankingAlgorithm)).toEqual([1, 2]);
    });

    it('orders by win percentage across movies with different vote totals', () => {
        // 1: 2W/0L = 100%, 2: 1W/1L = 50%, 3: 0W/2L = 0%
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [2, 3],
        ]);
        expect(rankedIds(state, winsRankingAlgorithm)).toEqual([1, 2, 3]);
    });

    it('formatMetric returns "100%" for an undefeated movie', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const winner = winsRankingAlgorithm.rank(state).find((m) => m.id === 1)!;
        expect(winsRankingAlgorithm.formatMetric(winner)).toBe('100%');
    });

    it('formatMetric returns "0%" for a movie with no votes', () => {
        const movie = {
            id: 99,
            title: 'Untested',
            createdAt: '',
            updatedAt: '',
            rating: 1500,
            winCount: 0,
            lossCount: 0,
        };
        expect(winsRankingAlgorithm.formatMetric(movie)).toBe('0%');
    });

    it('formatMetric rounds to nearest percent', () => {
        // 2 wins, 1 loss = 66.67% → rounds to 67%
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [4, 1],
        ]);
        const movie = winsRankingAlgorithm.rank(state).find((m) => m.id === 1)!;
        expect(winsRankingAlgorithm.formatMetric(movie)).toBe('67%');
    });
});
