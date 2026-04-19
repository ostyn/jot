import { MovieFaceoffRankedMovie } from '../../../interfaces/movie-faceoff.interface';
import { MovieFaceoffRankingAlgorithm } from '../types';

export const trimmedMeanRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'trimmed-mean',
    label: 'Olympic Score',
    description:
        'Aggregate: Olympic-style judging across all non-aggregate methods. Looks up each movie\'s rank in every primary algorithm, drops the best and worst, averages the rest.\n\nMetric: mean rank after trimming. Lower is better.\n\nPros: robust to an outlier algorithm. Cons: discards information; ties happen more often.',
    isAggregate: true,
    rank: (replay, primaryAlgorithms) => {
        const algorithms = (primaryAlgorithms || []).filter((a) => !a.isAggregate);
        if (!algorithms.length) return [];

        const ranksById = new Map<number, number[]>();
        const movieById = new Map<number, MovieFaceoffRankedMovie>();

        for (const algorithm of algorithms) {
            const ranked = algorithm.rank(replay);
            ranked.forEach((movie, index) => {
                const list = ranksById.get(movie.id) || [];
                list.push(index + 1);
                ranksById.set(movie.id, list);
                if (!movieById.has(movie.id)) movieById.set(movie.id, movie);
            });
        }

        return Array.from(movieById.values())
            .map((movie) => {
                const ranks = (ranksById.get(movie.id) || []).slice().sort((a, b) => a - b);
                const trimmed = ranks.length >= 4 ? ranks.slice(1, -1) : ranks;
                const mean = trimmed.length
                    ? trimmed.reduce((sum, r) => sum + r, 0) / trimmed.length
                    : Number.POSITIVE_INFINITY;
                return { ...movie, score: mean };
            })
            .sort((a, b) => (a.score ?? Infinity) - (b.score ?? Infinity));
    },
    formatMetric: (movie) =>
        movie.score === undefined || !Number.isFinite(movie.score)
            ? 'Unranked'
            : `#${movie.score.toFixed(1)} avg`,
};
