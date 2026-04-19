import { describe, expect, it } from 'vitest';
import { buildReplayFromVotes, rankedIds } from '../../../test/fixtures/movie-faceoff';
import { transitiveRankingAlgorithm } from './transitive';

describe('transitiveRankingAlgorithm', () => {
    it('is labeled "Transitive Rank" with id "transitive"', () => {
        expect(transitiveRankingAlgorithm.id).toBe('transitive');
        expect(transitiveRankingAlgorithm.label).toBe('Transitive Rank');
    });

    it('returns an empty list when no votes have been cast', () => {
        const state = buildReplayFromVotes([]);
        expect(transitiveRankingAlgorithm.rank(state)).toEqual([]);
    });

    it('credits a chain of wins transitively', () => {
        // 1 beat 2, 2 beat 3. 1 should get credit for "reaching" 3 through 2.
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const ranked = transitiveRankingAlgorithm.rank(state);
        // 1's score includes direct win over 2 + transitive reach to 3 → 2
        // 2's score is just direct win over 3 → 1
        // 3's score is 0
        expect(ranked.find((m) => m.id === 1)?.score).toBe(2);
        expect(ranked.find((m) => m.id === 2)?.score).toBe(1);
        expect(ranked.find((m) => m.id === 3)?.score).toBe(0);
    });

    it('ranks root of a win chain highest', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
            [3, 4],
        ]);
        expect(rankedIds(state, transitiveRankingAlgorithm)[0]).toBe(1);
    });

    it('formatMetric shows win count', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const [top] = transitiveRankingAlgorithm.rank(state);
        expect(transitiveRankingAlgorithm.formatMetric(top)).toBe('2 wins');
    });
});
