import { describe, expect, it } from 'vitest';
import {
    buildReplayFromVotes,
    stubAlgorithm,
} from '../../../test/fixtures/movie-faceoff';
import { MovieFaceoffRankingAlgorithm } from '../types';
import { controversyRankingAlgorithm } from './controversy';

describe('controversyRankingAlgorithm (Most Controversial)', () => {
    it('is marked informational', () => {
        expect(controversyRankingAlgorithm.id).toBe('controversy');
        expect(controversyRankingAlgorithm.isInformational).toBe(true);
    });

    it('returns an empty list when no primary algorithms are supplied', () => {
        const state = buildReplayFromVotes([[1, 2]]);
        expect(controversyRankingAlgorithm.rank(state, [])).toEqual([]);
    });

    it('filters out aggregates and informational algorithms from its inputs', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primary = stubAlgorithm('a', [1, 2, 3], state);
        const aggregate: MovieFaceoffRankingAlgorithm = {
            id: 'rrf',
            label: '',
            description: '',
            isAggregate: true,
            rank: () => {
                throw new Error('controversy should not call aggregates');
            },
            formatMetric: () => '',
        };
        const informational: MovieFaceoffRankingAlgorithm = {
            id: 'wins',
            label: '',
            description: '',
            isInformational: true,
            rank: () => {
                throw new Error('controversy should not call informational algos');
            },
            formatMetric: () => '',
        };
        const ranked = controversyRankingAlgorithm.rank(state, [
            primary,
            aggregate,
            informational,
        ]);
        // With one primary, every movie has a single percentile → MAD=0, stable order
        expect(ranked.map((m) => m.score)).toEqual([0, 0, 0]);
    });

    it('ranks disputed movies above agreed-upon ones', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        // Algo a: [1, 2, 3]; algo b: [3, 2, 1] → movie 2 is always in the middle (agreement),
        // movies 1 and 3 flip extremes (maximum disagreement).
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [3, 2, 1], state),
        ];
        const ranked = controversyRankingAlgorithm.rank(state, primaries);
        const movie2 = ranked.find((m) => m.id === 2)!;
        const movie1 = ranked.find((m) => m.id === 1)!;
        expect(movie2.score).toBe(0);
        expect(movie1.score).toBeGreaterThan(0);
        expect(ranked[ranked.length - 1].id).toBe(2);
    });

    it('formatMetric renders a percentage spread', () => {
        const state = buildReplayFromVotes([
            [1, 2],
            [2, 3],
        ]);
        const primaries = [
            stubAlgorithm('a', [1, 2, 3], state),
            stubAlgorithm('b', [3, 2, 1], state),
        ];
        const ranked = controversyRankingAlgorithm.rank(state, primaries);
        // Movie 1: percentiles [0, 1] → median 0.5, MAD = 0.5 → "±50.0%"
        expect(controversyRankingAlgorithm.formatMetric(ranked[0])).toBe('±50.0%');
    });
});
