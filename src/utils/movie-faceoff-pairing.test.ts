import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildReplayFromVotes, stubAlgorithm } from '../test/fixtures/movie-faceoff';
import {
    getCandidatePool,
    pickInformativeOpponent,
    pickInformativePair,
} from './movie-faceoff-pairing';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('getCandidatePool', () => {
    it('returns all ids when no filters apply', () => {
        const pool = getCandidatePool([1, 2, 3], new Set(), new Set());
        expect(pool).toEqual([1, 2, 3]);
    });

    it('filters out excluded ids', () => {
        const pool = getCandidatePool([1, 2, 3], new Set([2]), new Set());
        expect(pool).toEqual([1, 3]);
    });

    it('filters out unseen ids', () => {
        const pool = getCandidatePool([1, 2, 3], new Set(), new Set([3]));
        expect(pool).toEqual([1, 2]);
    });

    it('filters out explicit exclude list', () => {
        const pool = getCandidatePool([1, 2, 3, 4], new Set(), new Set(), [2, 4]);
        expect(pool).toEqual([1, 3]);
    });

    it('combines all three filters', () => {
        const pool = getCandidatePool([1, 2, 3, 4, 5], new Set([1]), new Set([2]), [3]);
        expect(pool).toEqual([4, 5]);
    });

    it('returns an empty array when everything is filtered', () => {
        const pool = getCandidatePool([1, 2], new Set([1]), new Set([2]));
        expect(pool).toEqual([]);
    });
});

describe('pickInformativeOpponent', () => {
    it('returns null when the pool only contains the first movie', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        const algorithms = [stubAlgorithm('a', [1, 2], state)];
        expect(pickInformativeOpponent([1], state, algorithms, 1)).toBeNull();
    });

    it('strongly prefers the high-disagreement opponent over a unanimous opponent', () => {
        // Three movies, all with identical cold-start (so disagreement is the
        // only differentiator).
        // Movies 1 and 2: algorithms split 2-2 → high disagreement.
        // Movies 1 and 3: algorithms unanimously rank 1 above 3 → 0 disagreement.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const algorithms = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [1, 2, 3], state),
            stubAlgorithm('c', [2, 1, 3], state),
            stubAlgorithm('d', [2, 1, 3], state),
        ];
        // With 4 algorithms ranking both, disagreement(1,2) = 1 * 4/6 ≈ 0.667.
        // disagreement(1,3) = 0. Cold-start ≈ same for both candidates.
        // Pick the candidate at the front of the cumulative weight: with
        // random=0 we land on the first slot, which is candidate 2.
        vi.spyOn(Math, 'random').mockReturnValue(0);
        expect(pickInformativeOpponent([2, 3], state, algorithms, 1)).toBe(2);
    });

    it('falls back to cold-start when no algorithm has an opinion', () => {
        // No primary algorithms → matrix is empty → disagreement is 0
        // everywhere → cold-start is the only signal.
        const state = buildReplayFromVotes([
            [1, 2],
            [3, 4],
        ]);
        // Movie 2 has more votes (lower cold-start); movie 3 has fewer.
        // With identical RDs, the lower-vote one should win at low random.
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const result = pickInformativeOpponent([2, 3], state, [], 1);
        // First slot fires — candidate 2 here.
        expect(result).toBe(2);
    });

    it('skips the first movie when it appears in the pool', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const algorithms = [stubAlgorithm('a', [1, 2, 3], state)];
        vi.spyOn(Math, 'random').mockReturnValue(0);
        // First movie 1 is in the pool but should be filtered out.
        expect(pickInformativeOpponent([1, 2, 3], state, algorithms, 1)).toBe(2);
    });
});

describe('pickInformativePair', () => {
    it('returns null when either pool is empty', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(pickInformativePair([], [1, 2], state, [])).toBeNull();
        expect(pickInformativePair([1, 2], [], state, [])).toBeNull();
    });

    it('returns a valid pair from the cross of the two pools', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const algorithms = [stubAlgorithm('a', [1, 2, 3], state)];
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const pair = pickInformativePair([1, 2], [2, 3], state, algorithms);
        expect(pair).not.toBeNull();
        expect(pair![0]).not.toBe(pair![1]);
    });

    it('falls back to cold-start signal when no algorithms are supplied', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        vi.spyOn(Math, 'random').mockReturnValue(0);
        const pair = pickInformativePair([1, 2, 3], [1, 2, 3], state, []);
        expect(pair).not.toBeNull();
        expect(pair![0]).not.toBe(pair![1]);
    });

    it('returns null when both pools are the single same id', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(pickInformativePair([1], [1], state, [])).toBeNull();
    });
});
