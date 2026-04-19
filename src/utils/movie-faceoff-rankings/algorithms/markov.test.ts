import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { markovRankingAlgorithm } from './markov';

describe('markovRankingAlgorithm', () => {
    it('is labeled "Markov Ranking" with id "markov"', () => {
        expect(markovRankingAlgorithm.id).toBe('markov');
        expect(markovRankingAlgorithm.label).toBe('Markov Ranking');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(markovRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('ranks winners above losers in a chain', () => {
        // 1 beats 2, 2 beats 3 — root (1) should end up on top.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        expect(rankedIds(state, markovRankingAlgorithm)).toEqual([1, 2, 3]);
    });

    it('assigns positive scores to every movie', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [2, 3],
        ]);
        const ranked = markovRankingAlgorithm.rank(state);
        for (const movie of ranked) {
            expect(movie.score).toBeGreaterThan(0);
        }
    });

    it('places a dominator above clear losers', () => {
        // Movie 1 beats everyone; should be first.
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [1, 4],
            [2, 3],
        ]);
        expect(rankedIds(state, markovRankingAlgorithm)[0]).toBe(1);
    });

    it('formatMetric renders a percentage with two decimals', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const [winner] = markovRankingAlgorithm.rank(state);
        expect(markovRankingAlgorithm.formatMetric(winner)).toMatch(/^\d+\.\d{2}%$/);
    });
});
