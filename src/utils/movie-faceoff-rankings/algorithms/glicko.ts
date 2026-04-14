import { MovieFaceoffRankingAlgorithm } from '../types';

export const glickoRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'glicko',
    label: 'Glicko Rating',
    description:
        'Like Elo, but also tracks uncertainty.\n\nMetric: `rating±RD`. Higher rating is better; lower RD means more confidence.\n\nPros: uncertainty-aware, better for sparse data. Cons: less intuitive than Elo.',
    rank: (replay) =>
        Array.from(replay.ratings.values()).sort((a, b) => {
            // Sort by rating, but consider rating deviation for ties
            const ratingDiff = (b.glickoRating ?? b.rating) - (a.glickoRating ?? a.rating);
            if (Math.abs(ratingDiff) > 1) return ratingDiff;

            // For near-equal ratings, prefer lower RD (more certain)
            const aRD = a.ratingDeviation || 350;
            const bRD = b.ratingDeviation || 350;
            return aRD - bRD;
        }),
    formatMetric: (movie) => {
        const rating = Math.round(movie.glickoRating ?? movie.rating);
        const rd = Math.round(movie.ratingDeviation || 350);
        return `${rating}±${rd}`;
    },
};
