import { MovieFaceoffRankingAlgorithm } from '../types';

export const winsRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'wins',
    label: 'Win Rate',
    description:
        'Ranks movies by the share of votes they win, breaking ties by total votes.\n\nMetric: win percentage (ties broken by total votes).\n\nPros: easiest to understand. Cons: ignores opponent strength, so small samples swing wildly. Informational only — does not contribute to aggregate rankings.',
    isInformational: true,
    rank: (replay) =>
        Array.from(replay.ratings.values()).sort((a, b) => {
            const aTotal = a.winCount + a.lossCount;
            const bTotal = b.winCount + b.lossCount;
            const aRate = aTotal ? a.winCount / aTotal : 0;
            const bRate = bTotal ? b.winCount / bTotal : 0;
            if (bRate !== aRate) return bRate - aRate;
            return bTotal - aTotal;
        }),
    formatMetric: (movie) => {
        const totalGames = movie.winCount + movie.lossCount;
        return totalGames ? `${Math.round((movie.winCount / totalGames) * 100)}%` : '0%';
    },
};
