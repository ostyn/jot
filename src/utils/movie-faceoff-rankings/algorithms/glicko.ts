import { MovieFaceoffRankingAlgorithm } from '../types';

export const glickoRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'glicko',
    label: 'Glicko Rating',
    description:
        'Glicko improves on Elo by accounting for rating uncertainty and time-based changes. Movies with fewer votes have higher rating deviation (RD), indicating less confidence in their ranking. The system automatically adjusts ratings based on both match results and the reliability of those results.\n\nThis provides more accurate rankings when data is sparse and gives users a sense of how confident they can be in each movie\'s position.',
    rank: (replay) =>
        Array.from(replay.ratings.values()).sort((a, b) => {
            // Sort by rating, but consider rating deviation for ties
            const ratingDiff = b.rating - a.rating;
            if (Math.abs(ratingDiff) > 1) return ratingDiff;

            // For near-equal ratings, prefer lower RD (more certain)
            const aRD = a.ratingDeviation || 350;
            const bRD = b.ratingDeviation || 350;
            return aRD - bRD;
        }),
    formatMetric: (movie) => {
        const rating = Math.round(movie.rating);
        const rd = Math.round(movie.ratingDeviation || 350);
        return `${rating}±${rd}`;
    },
};