import { MovieFaceoffRankingAlgorithm } from '../types';

export const winsRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'wins',
    label: 'Win Rate',
    description:
        'Win Rate ranks movies by the percentage of recorded votes they have won. It is the easiest ranking to understand because the score directly answers, “How often does this movie win?”\n\nThe tradeoff is that it ignores opponent strength and can flatter movies with a small number of favorable matchups, so it is best used as a simple sanity check rather than the smartest overall ordering.',
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
