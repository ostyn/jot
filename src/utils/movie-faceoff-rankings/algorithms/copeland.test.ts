import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { copelandRankingAlgorithm } from './copeland';

describe('copelandRankingAlgorithm', () => {
    it('is labeled "Copeland Score" with id "copeland"', () => {
        expect(copelandRankingAlgorithm.id).toBe('copeland');
        expect(copelandRankingAlgorithm.label).toBe('Copeland Score');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(copelandRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('scores net pairwise wins (wins - losses)', () => {
        // 1 beats 2, 1 beats 3, 2 beats 3
        // Scores: 1 = 2 - 0 = 2; 2 = 1 - 1 = 0; 3 = 0 - 2 = -2
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [2, 3],
        ]);
        const ranked = copelandRankingAlgorithm.rank(state);
        expect(ranked.map((m) => ({ id: m.id, score: m.score }))).toEqual([
            { id: 1, score: 2 },
            { id: 2, score: 0 },
            { id: 3, score: -2 },
        ]);
    });

    it('counts each pair at most once (Copeland is set-based, not vote-count)', () => {
        // 1 beats 2 five times → still just one pairwise win
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 2],
            [1, 2],
        ]);
        const ranked = copelandRankingAlgorithm.rank(state);
        expect(ranked.find((m) => m.id === 1)?.score).toBe(1);
        expect(ranked.find((m) => m.id === 2)?.score).toBe(-1);
    });

    it('places undefeated movies at the top', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [1, 4],
            [2, 3],
        ]);
        expect(rankedIds(state, copelandRankingAlgorithm)[0]).toBe(1);
    });

    it('formatMetric shows net wins', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const [winner] = copelandRankingAlgorithm.rank(state);
        expect(copelandRankingAlgorithm.formatMetric(winner)).toBe('1 net wins');
    });
});
