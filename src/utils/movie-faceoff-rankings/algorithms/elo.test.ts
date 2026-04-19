import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { eloRankingAlgorithm } from './elo';

describe('eloRankingAlgorithm', () => {
    it('is labeled "Elo Score" with id "elo"', () => {
        expect(eloRankingAlgorithm.id).toBe('elo');
        expect(eloRankingAlgorithm.label).toBe('Elo Score');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(eloRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('ranks the winner above the loser after one vote', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(rankedIds(state, eloRankingAlgorithm)).toEqual([1, 2]);
    });

    it('orders by rating descending across multiple votes', () => {
        // 1 beats 2, 2 beats 3, 1 beats 3 → expected order [1, 2, 3]
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
            [1, 3],
        ]);
        expect(rankedIds(state, eloRankingAlgorithm)).toEqual([1, 2, 3]);
    });

    it('formatMetric renders rounded points', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const [winner] = eloRankingAlgorithm.rank(state);
        expect(eloRankingAlgorithm.formatMetric(winner)).toBe('1516 pts');
    });
});
