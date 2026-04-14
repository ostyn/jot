import { MovieFaceoffRankingAlgorithm } from '../types';

export const eloRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'elo',
    label: 'Elo Score',
    description:
        'Updates after each vote based on how surprising the result was.\n\nMetric: Elo points. Higher is better, with 1500 as the rough starting point.\n\nPros: simple, responsive, opponent-aware. Cons: no explicit uncertainty.',
    rank: (replay) =>
        Array.from(replay.ratings.values()).sort((a, b) => b.rating - a.rating),
    formatMetric: (movie) => `${Math.round(movie.rating)} pts`,
};
