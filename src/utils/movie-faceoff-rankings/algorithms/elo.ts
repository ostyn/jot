import { MovieFaceoffRankingAlgorithm } from '../types';

export const eloRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'elo',
    label: 'Elo Score',
    description:
        'Elo updates each movie after every vote based on how surprising the result was. Beating a movie that is already ranked highly is worth more than beating a weak one, and losing to a weaker movie hurts more.\n\nIt is a strong default when you want a ranking that reacts quickly, respects vote order, and takes opponent strength into account without becoming too hard to interpret.',
    rank: (replay) =>
        Array.from(replay.ratings.values()).sort((a, b) => b.rating - a.rating),
    formatMetric: (movie) => `${Math.round(movie.rating)} pts`,
};
