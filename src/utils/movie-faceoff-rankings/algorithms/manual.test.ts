import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { manualRankingAlgorithm } from './manual';

describe('manualRankingAlgorithm', () => {
    it('is labeled "Insert Rank" with id "manual"', () => {
        expect(manualRankingAlgorithm.id).toBe('manual');
        expect(manualRankingAlgorithm.label).toBe('Insert Rank');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(manualRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('matches manualList order exactly', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
            [1, 3],
        ]);
        expect(rankedIds(state, manualRankingAlgorithm)).toEqual(state.manualList);
    });

    it('reflects upsets (push-based reordering without targetId)', () => {
        // [1, 2] then 2 beats 1 → manualList = [2, 1]
        const state = buildReplayFromVotes([[1, 2], [2, 1]]);
        expect(rankedIds(state, manualRankingAlgorithm)).toEqual([2, 1]);
    });

    it('respects targetId by moving only the target, not the pivot', () => {
        // Build [1, 2, 3, 4], then re-rank 1 below 3 via a targeted vote
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
            [3, 4],
            [3, 1, 1], // targetId=1, pivot=3 wins
        ]);
        // Target 1 moves below pivot 3; pivot 3 stays in place.
        expect(rankedIds(state, manualRankingAlgorithm)).toEqual([2, 3, 1, 4]);
    });

    it('targeted re-rank is idempotent', () => {
        // Same targeted vote applied twice should produce the same list (target can't stabilize elsewhere)
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
            [3, 4],
            [3, 1, 1],
            [3, 1, 1], // repeat
        ]);
        expect(rankedIds(state, manualRankingAlgorithm)).toEqual([2, 3, 1, 4]);
    });

    it('formatMetric returns empty string (no numeric score)', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const [first] = manualRankingAlgorithm.rank(state);
        expect(manualRankingAlgorithm.formatMetric(first)).toBe('');
    });

    it('skips movies missing from ratings (defensive)', () => {
        // Construct a state where manualList references an id not in ratings
        const state = buildReplayFromVotes([[1, 2]]);
        state.manualList = [...state.manualList, 999];
        const ranked = manualRankingAlgorithm.rank(state);
        expect(ranked.map((m) => m.id)).toEqual([1, 2]);
    });
});
