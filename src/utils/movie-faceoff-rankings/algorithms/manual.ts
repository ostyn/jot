import {
    MovieFaceoffRankedMovie,
} from '../../../interfaces/movie-faceoff.interface';
import { MovieFaceoffRankingAlgorithm } from '../types';

function computeManualRankings(replay: {
    manualList: number[];
    ratings: Map<number, MovieFaceoffRankedMovie>;
}) {
    return replay.manualList
        .map((id) => replay.ratings.get(id))
        .filter((movie): movie is MovieFaceoffRankedMovie => Boolean(movie));
}

export const manualRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'manual',
    label: 'Insert Rank',
    description:
        'Insert Rank rebuilds a single ordered list by replaying votes in sequence and moving winners ahead of losers as those decisions happen. Because it follows the exact order of the session history, it preserves the chronology of your choices in a way the score-based systems do not.\n\nThis makes it especially useful for experimentation with order-sensitive ideas, but it also means early decisions can shape the list strongly until later votes correct them.',
    rank: computeManualRankings,
    formatMetric: () => '',
};
