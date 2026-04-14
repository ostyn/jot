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
        'Replays votes in order and moves winners ahead of losers.\n\nMetric: no separate score, only list position.\n\nPros: matches vote history exactly. Cons: heavily order-dependent.',
    rank: computeManualRankings,
    formatMetric: () => '',
};
