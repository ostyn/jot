import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { schulzeRankingAlgorithm } from './schulze';

describe('schulzeRankingAlgorithm', () => {
    it('is labeled "Schulze Method" with id "schulze"', () => {
        expect(schulzeRankingAlgorithm.id).toBe('schulze');
        expect(schulzeRankingAlgorithm.label).toBe('Schulze Method');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(schulzeRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('ranks a transitive chain in order', () => {
        // 1 > 2 > 3 — transitive, no cycle.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        expect(rankedIds(state, schulzeRankingAlgorithm)).toEqual([1, 2, 3]);
    });

    it('places a Condorcet winner first', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [1, 4],
            [2, 3],
        ]);
        expect(rankedIds(state, schulzeRankingAlgorithm)[0]).toBe(1);
    });

    it('uses vote counts (not just set membership) to break direct conflicts', () => {
        // 2 beats 1 by majority (2 votes vs 1) — Schulze should prefer 2.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 1],
            [2, 1],
        ]);
        expect(rankedIds(state, schulzeRankingAlgorithm)).toEqual([2, 1]);
    });

    it('resolves a cycle by strongest path', () => {
        // 1 > 2 (3 votes), 2 > 3 (3 votes), 3 > 1 (1 vote).
        // The 3 → 1 edge is weak; strongest paths put 1 on top.
        const state = buildReplayFromVotes([
            [1, 2], [1, 2], [1, 2],
            [2, 3], [2, 3], [2, 3],
            [3, 1],
        ]);
        const scores = schulzeRankingAlgorithm.rank(state);
        expect(scores.map((m) => m.id)).toEqual([1, 2, 3]);
        expect(scores.map((m) => m.score)).toEqual([2, 1, 0]);
    });

    it('formatMetric describes the strongest-path beat count', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const [winner] = schulzeRankingAlgorithm.rank(state);
        expect(schulzeRankingAlgorithm.formatMetric(winner)).toBe(
            'beats 1 via strongest path'
        );
    });
});
