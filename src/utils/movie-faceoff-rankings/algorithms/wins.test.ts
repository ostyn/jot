import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { winsRankingAlgorithm } from './wins';

describe('winsRankingAlgorithm (Win Rate)', () => {
    it('is labeled "Win Rate" with id "wins" and marked informational', () => {
        expect(winsRankingAlgorithm.id).toBe('wins');
        expect(winsRankingAlgorithm.label).toBe('Win Rate');
        expect(winsRankingAlgorithm.isInformational).toBe(true);
    });

    it('orders by win percentage across movies with different vote totals', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [2, 3],
        ]);
        expect(rankedIds(state, winsRankingAlgorithm)).toEqual([1, 2, 3]);
    });

    it('breaks ties on win rate by total votes', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 2],
            [3, 4],
        ]);
        expect(rankedIds(state, winsRankingAlgorithm)).toEqual([1, 3, 2, 4]);
    });

    it('formatMetric rounds to nearest percent', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [4, 1],
        ]);
        const movie = winsRankingAlgorithm.rank(state).find((m) => m.id === 1)!;
        expect(winsRankingAlgorithm.formatMetric(movie)).toBe('67%');
    });
});
