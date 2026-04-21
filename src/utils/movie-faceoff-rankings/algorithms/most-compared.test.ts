import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { mostComparedRankingAlgorithm } from './most-compared';

describe('mostComparedRankingAlgorithm (Most Compared)', () => {
    it('is marked informational', () => {
        expect(mostComparedRankingAlgorithm.id).toBe('most-compared');
        expect(mostComparedRankingAlgorithm.isInformational).toBe(true);
    });

    it('sorts by total faceoff count descending', () => {
        // 1 appears 3x, 2 appears 2x, 3 appears 1x
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 3],
            [1, 2],
        ]);
        expect(rankedIds(state, mostComparedRankingAlgorithm)).toEqual([1, 2, 3]);
    });

    it('formats the metric as "N faceoffs" (singular for 1)', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [1, 2],
        ]);
        const ranked = mostComparedRankingAlgorithm.rank(state);
        const movie1 = ranked.find((m) => m.id === 1)!;
        expect(mostComparedRankingAlgorithm.formatMetric(movie1)).toBe('2 faceoffs');

        const stateOne = buildReplayFromVotes([[1, 2]]);
        const rankedOne = mostComparedRankingAlgorithm.rank(stateOne);
        const movieA = rankedOne.find((m) => m.id === 1)!;
        expect(mostComparedRankingAlgorithm.formatMetric(movieA)).toBe('1 faceoff');
    });
});
