import { describe, expect, it } from 'vitest';
import {
    buildMovieFaceoffReplayState,
} from '../replay-state';
import { makeEvents, makeMovie } from '../../../test/fixtures/movie-faceoff';
import { alphabeticalRankingAlgorithm } from './alphabetical';

describe('alphabeticalRankingAlgorithm (A–Z)', () => {
    it('is marked informational', () => {
        expect(alphabeticalRankingAlgorithm.id).toBe('alphabetical');
        expect(alphabeticalRankingAlgorithm.isInformational).toBe(true);
    });

    it('sorts titles case-insensitively using locale comparison', () => {
        const state = buildMovieFaceoffReplayState(
            makeEvents([
                [1, 2],
                [2, 3],
            ]),
            [
                makeMovie(1, { title: 'Zodiac' }),
                makeMovie(2, { title: 'apollo 13' }),
                makeMovie(3, { title: 'Memento' }),
            ]
        );
        expect(alphabeticalRankingAlgorithm.rank(state).map((m) => m.title)).toEqual([
            'apollo 13',
            'Memento',
            'Zodiac',
        ]);
    });

    it('returns no metric text', () => {
        const state = buildMovieFaceoffReplayState(makeEvents([[1, 2]]), [
            makeMovie(1),
            makeMovie(2),
        ]);
        const [first] = alphabeticalRankingAlgorithm.rank(state);
        expect(alphabeticalRankingAlgorithm.formatMetric(first)).toBe('');
    });
});
