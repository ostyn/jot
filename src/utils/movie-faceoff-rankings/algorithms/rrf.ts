import { MovieFaceoffRankedMovie } from '../../../interfaces/movie-faceoff.interface';
import { MovieFaceoffRankingAlgorithm } from '../types';

const RRF_K = 60;

export const rrfRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'rrf',
    label: 'Weighted Consensus',
    description:
        'Aggregate: combines all non-aggregate methods via Reciprocal Rank Fusion, giving extra weight to top ranks.\n\nMetric: sum of 1 / (60 + rank_in_algorithm) across each primary algorithm. Higher is better.\n\nPros: heavily rewards agreement near the top; robust to outliers. Cons: raw score is opaque — use it as a "consensus" signal.',
    isAggregate: true,
    rank: (replay, primaryAlgorithms) => {
        const algorithms = (primaryAlgorithms || []).filter((a) => !a.isAggregate);
        if (!algorithms.length) return [];

        const scoreById = new Map<number, number>();
        const movieById = new Map<number, MovieFaceoffRankedMovie>();

        for (const algorithm of algorithms) {
            const ranked = algorithm.rank(replay);
            ranked.forEach((movie, index) => {
                const current = scoreById.get(movie.id) || 0;
                scoreById.set(movie.id, current + 1 / (RRF_K + index + 1));
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
    formatMetric: (movie) => `${((movie.score || 0) * 1000).toFixed(1)}`,
};
