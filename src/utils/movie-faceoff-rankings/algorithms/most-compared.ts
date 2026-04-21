import { MovieFaceoffRankingAlgorithm } from '../types';

export const mostComparedRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'most-compared',
    label: 'Most Compared',
    description:
        "Sorts movies by how many faceoffs they've appeared in. Useful as a data-confidence signal — movies at the top have the most-settled rank; movies at the bottom are undersampled.\n\nMetric: total faceoffs (wins + losses), tie-broken by title.\n\nInformational only — does not contribute to aggregate rankings.",
    isInformational: true,
    rank: (replay) =>
        Array.from(replay.ratings.values()).sort((a, b) => {
            const diff = b.winCount + b.lossCount - (a.winCount + a.lossCount);
            if (diff !== 0) return diff;
            return a.title.localeCompare(b.title);
        }),
    formatMetric: (movie) => {
        const total = movie.winCount + movie.lossCount;
        return `${total} faceoff${total === 1 ? '' : 's'}`;
    },
};
