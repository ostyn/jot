import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { glickoRankingAlgorithm } from './glicko';

describe('glickoRankingAlgorithm', () => {
    it('is labeled "Glicko Rating" with id "glicko"', () => {
        expect(glickoRankingAlgorithm.id).toBe('glicko');
        expect(glickoRankingAlgorithm.label).toBe('Glicko Rating');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(glickoRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('ranks the winner above the loser', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(rankedIds(state, glickoRankingAlgorithm)).toEqual([1, 2]);
    });

    it('uses rating deviation as a tiebreaker for near-equal ratings', () => {
        // Build a state manually so we can force equal ratings with different RDs
        const state = buildReplayFromVotes([[1, 2]]);
        const a = state.ratings.get(1)!;
        const b = state.ratings.get(2)!;
        a.glickoRating = 1500;
        b.glickoRating = 1500;
        a.ratingDeviation = 100; // more certain
        b.ratingDeviation = 300; // less certain
        const ranked = glickoRankingAlgorithm.rank(state);
        // Lower RD (more certain) wins the tiebreak
        expect(ranked[0].id).toBe(1);
        expect(ranked[1].id).toBe(2);
    });

    it('formatMetric shows rating and RD together', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const [winner] = glickoRankingAlgorithm.rank(state);
        const formatted = glickoRankingAlgorithm.formatMetric(winner);
        expect(formatted).toMatch(/^\d+±\d+$/);
    });

    it('formatMetric falls back to defaults if rating or RD is missing', () => {
        const movie = {
            id: 1,
            title: 'Test',
            createdAt: '',
            updatedAt: '',
            rating: 1500,
            winCount: 0,
            lossCount: 0,
            glickoRating: undefined,
            ratingDeviation: undefined,
        };
        expect(glickoRankingAlgorithm.formatMetric(movie)).toBe('1500±350');
    });
});
