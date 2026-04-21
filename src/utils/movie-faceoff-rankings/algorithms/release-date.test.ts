import { describe, expect, it } from 'vitest';
import { makeEvents, makeMovie } from '../../../test/fixtures/movie-faceoff';
import { buildMovieFaceoffReplayState } from '../replay-state';
import { releaseDateRankingAlgorithm } from './release-date';

describe('releaseDateRankingAlgorithm (Release Date)', () => {
    it('is marked informational', () => {
        expect(releaseDateRankingAlgorithm.id).toBe('release-date');
        expect(releaseDateRankingAlgorithm.isInformational).toBe(true);
    });

    it('sorts newest release first', () => {
        const state = buildMovieFaceoffReplayState(
            makeEvents([
                [1, 2],
                [2, 3],
            ]),
            [
                makeMovie(1, { releaseDate: '1999-03-31' }),
                makeMovie(2, { releaseDate: '2024-07-12' }),
                makeMovie(3, { releaseDate: '2010-01-01' }),
            ]
        );
        expect(releaseDateRankingAlgorithm.rank(state).map((m) => m.id)).toEqual([
            2, 3, 1,
        ]);
    });

    it('places movies without a release date at the bottom', () => {
        const state = buildMovieFaceoffReplayState(
            makeEvents([
                [1, 2],
                [2, 3],
            ]),
            [
                makeMovie(1, { releaseDate: '2010-01-01' }),
                makeMovie(2, { title: 'A Mystery' }),
                makeMovie(3, { title: 'Z Mystery' }),
            ]
        );
        const ranked = releaseDateRankingAlgorithm.rank(state);
        expect(ranked.map((m) => m.id)).toEqual([1, 2, 3]);
    });

    it('shows the release date in formatMetric', () => {
        const state = buildMovieFaceoffReplayState(makeEvents([[1, 2]]), [
            makeMovie(1, { releaseDate: '2024-07-12' }),
            makeMovie(2),
        ]);
        const [first] = releaseDateRankingAlgorithm.rank(state);
        expect(releaseDateRankingAlgorithm.formatMetric(first)).toBe('2024-07-12');
    });
});
