import { MovieFaceoffRankedMovie } from '../../../interfaces/movie-faceoff.interface';
import { MovieFaceoffRankingAlgorithm } from '../types';

export const bordaRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'borda',
    label: 'Borda Count',
    description:
        'Aggregate: sums positional points across all non-aggregate methods. Each movie earns (N − 1 − position) points from every primary algorithm and the totals are summed.\n\nMetric: total Borda points. Higher is better.\n\nPros: simple linear weighting — every position matters equally. Cons: a single bottom finish hurts as much as a top finish helps; no top-bias like RRF.',
    isAggregate: true,
    rank: (replay, primaryAlgorithms) => {
        const algorithms = (primaryAlgorithms || []).filter(
            (a) => !a.isAggregate && !a.isInformational
        );
        if (!algorithms.length) return [];

        const scoreById = new Map<number, number>();
        const movieById = new Map<number, MovieFaceoffRankedMovie>();

        for (const algorithm of algorithms) {
            const ranked = algorithm.rank(replay);
            const n = ranked.length;
            ranked.forEach((movie, index) => {
                const points = n - 1 - index;
                scoreById.set(movie.id, (scoreById.get(movie.id) || 0) + points);
                if (!movieById.has(movie.id)) movieById.set(movie.id, movie);
            });
        }

        return Array.from(movieById.values())
            .map((movie) => ({
                ...movie,
                score: scoreById.get(movie.id) || 0,
            }))
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    },
    formatMetric: (movie) => `${movie.score} pts`,
};
