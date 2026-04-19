import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { bradleyTerryRankingAlgorithm } from './bradley-terry';

describe('bradleyTerryRankingAlgorithm', () => {
    it('is labeled "Bradley-Terry Ranking" with id "bradley-terry"', () => {
        expect(bradleyTerryRankingAlgorithm.id).toBe('bradley-terry');
        expect(bradleyTerryRankingAlgorithm.label).toBe('Bradley-Terry Ranking');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(bradleyTerryRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('ranks winners above losers in a simple linear order', () => {
        // 1 beats 2, 2 beats 3. Bradley-Terry should produce 1 > 2 > 3.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        expect(rankedIds(state, bradleyTerryRankingAlgorithm)).toEqual([1, 2, 3]);
    });

    it('orders undefeated movie above any loser', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [2, 3],
            [1, 4],
        ]);
        expect(rankedIds(state, bradleyTerryRankingAlgorithm)[0]).toBe(1);
    });

    it('produces strength scores greater than zero', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const ranked = bradleyTerryRankingAlgorithm.rank(state);
        for (const movie of ranked) {
            expect(movie.score).toBeGreaterThan(0);
        }
    });

    it('formatMetric includes strength label', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const [winner] = bradleyTerryRankingAlgorithm.rank(state);
        expect(bradleyTerryRankingAlgorithm.formatMetric(winner)).toMatch(/^\d+\.\d{2} strength$/);
    });
});
