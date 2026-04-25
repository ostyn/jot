import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { minimaxRankingAlgorithm } from './minimax';

describe('minimaxRankingAlgorithm', () => {
    it('is labeled "Minimax" with id "minimax"', () => {
        expect(minimaxRankingAlgorithm.id).toBe('minimax');
        expect(minimaxRankingAlgorithm.label).toBe('Minimax');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(minimaxRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('gives an undefeated movie a score of 0 (no losing margin)', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
        ]);
        const winner = minimaxRankingAlgorithm.rank(state).find((m) => m.id === 1);
        expect(winner?.score).toBe(0);
    });

    it('penalizes a movie by its single worst loss margin', () => {
        // 2 loses to 1 by 3 votes, loses to 3 by 1 vote — worst loss is 3.
        const state = buildReplayFromVotes([
            [1, 2], [1, 2], [1, 2],
            [3, 2],
        ]);
        const movie2 = minimaxRankingAlgorithm.rank(state).find((m) => m.id === 2);
        expect(movie2?.score).toBe(-3);
    });

    it('puts a movie with the smallest worst loss on top', () => {
        // 1: never loses. 2: worst loss to 1 by 1. 3: worst loss to 2 by 1.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        expect(rankedIds(state, minimaxRankingAlgorithm)[0]).toBe(1);
    });

    it('rewards consistency over total wins', () => {
        // 1 has many wins but one bad loss; 2 has fewer wins but no big loss.
        const state = buildReplayFromVotes([
            [1, 3], [1, 3], [1, 3],
            [4, 1], [4, 1], [4, 1], [4, 1], [4, 1], // 1 loses to 4 by 5
            [2, 4],                                    // 2 just beats 4 once
        ]);
        const ranked = minimaxRankingAlgorithm.rank(state);
        const movie1 = ranked.find((m) => m.id === 1)!;
        const movie2 = ranked.find((m) => m.id === 2)!;
        expect(movie1.score).toBe(-5);
        expect(movie2.score).toBe(0);
        expect(ranked.findIndex((m) => m.id === 2)).toBeLessThan(
            ranked.findIndex((m) => m.id === 1)
        );
    });

    it('ignores ties (equal votes both ways) — they are not "losses"', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 1],
        ]);
        const ranked = minimaxRankingAlgorithm.rank(state);
        expect(ranked.find((m) => m.id === 1)?.score).toBe(0);
        expect(ranked.find((m) => m.id === 2)?.score).toBe(0);
    });

    it('formatMetric reports "no losing margin" for an undefeated movie', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const winner = minimaxRankingAlgorithm.rank(state).find((m) => m.id === 1)!;
        expect(minimaxRankingAlgorithm.formatMetric(winner)).toBe('no losing margin');
    });

    it('formatMetric reports the worst-loss size for a beaten movie', () => {
        const state = buildReplayFromVotes([[1, 2], [1, 2]]);
        const loser = minimaxRankingAlgorithm.rank(state).find((m) => m.id === 2)!;
        expect(minimaxRankingAlgorithm.formatMetric(loser)).toBe('worst loss by 2');
    });
});
