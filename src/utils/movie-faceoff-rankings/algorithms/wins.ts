import { MovieFaceoffRankingAlgorithm } from '../types';

export const winsRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'wins',
    label: 'Win Rate',
    description:
        'Ranks movies by the share of votes they win.\n\nMetric: win percentage.\n\nPros: easiest to understand. Cons: ignores opponent strength and sample size.',
    rank: (replay) =>
        Array.from(replay.ratings.values()).sort((a, b) => {
            const aTotal = a.winCount + a.lossCount;
            const bTotal = b.winCount + b.lossCount;
            const aRate = aTotal ? a.winCount / aTotal : 0;
            const bRate = bTotal ? b.winCount / bTotal : 0;
            return bRate - aRate;
        }),
    formatMetric: (movie) => {
        const totalGames = movie.winCount + movie.lossCount;
        return totalGames ? `${Math.round((movie.winCount / totalGames) * 100)}%` : '0%';
    },
};
