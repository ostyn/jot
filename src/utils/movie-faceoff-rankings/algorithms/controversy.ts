import { MovieFaceoffRankedMovie } from '../../../interfaces/movie-faceoff.interface';
import { MovieFaceoffRankingAlgorithm } from '../types';

function median(values: number[]): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export const controversyRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'controversy',
    label: 'Most Controversial',
    description:
        'Surfaces movies where the primary algorithms disagree most on placement. For each primary algorithm, each movie gets a percentile-normalized rank (0 = top, 1 = bottom); the score is the mean absolute deviation from that movie\'s median percentile.\n\nMetric: percentile spread (±X%). Higher means more disagreement.\n\nPros: robust to a single outlier algorithm; scale-invariant across the list. Cons: movies seen by only one algorithm register as 0. Informational only — does not contribute to aggregate rankings.',
    isInformational: true,
    rank: (replay, primaryAlgorithms) => {
        const algorithms = (primaryAlgorithms || []).filter(
            (a) => !a.isAggregate && !a.isInformational
        );
        if (!algorithms.length) return [];

        const percentilesById = new Map<number, number[]>();
        const movieById = new Map<number, MovieFaceoffRankedMovie>();

        for (const algorithm of algorithms) {
            const ranked = algorithm.rank(replay);
            const total = ranked.length;
            if (!total) continue;
            ranked.forEach((movie, index) => {
                const percentile = total === 1 ? 0 : index / (total - 1);
                const list = percentilesById.get(movie.id) || [];
                list.push(percentile);
                percentilesById.set(movie.id, list);
                if (!movieById.has(movie.id)) movieById.set(movie.id, movie);
            });
        }

        return Array.from(movieById.values())
            .map((movie) => {
                const percentiles = percentilesById.get(movie.id) || [];
                if (percentiles.length < 2) return { ...movie, score: 0 };
                const med = median(percentiles);
                const mad =
                    percentiles.reduce((sum, p) => sum + Math.abs(p - med), 0) /
                    percentiles.length;
                return { ...movie, score: mad };
            })
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    },
    formatMetric: (movie) =>
        movie.score === undefined
            ? '—'
            : `±${((movie.score || 0) * 100).toFixed(1)}%`,
};
