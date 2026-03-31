import { MovieFaceoffSortMode } from '../../interfaces/movie-faceoff.interface';
import { bradleyTerryRankingAlgorithm } from './algorithms/bradley-terry';
import { copelandRankingAlgorithm } from './algorithms/copeland';
import { eloRankingAlgorithm } from './algorithms/elo';
import { manualRankingAlgorithm } from './algorithms/manual';
import { markovRankingAlgorithm } from './algorithms/markov';
import { transitiveRankingAlgorithm } from './algorithms/transitive';
import { winsRankingAlgorithm } from './algorithms/wins';
import { MovieFaceoffRankingAlgorithm, MovieFaceoffReplayState } from './types';

export * from './types';
export { buildMovieFaceoffReplayState } from './replay-state';

export const MOVIE_FACEOFF_RANKING_ALGORITHMS: readonly MovieFaceoffRankingAlgorithm[] =
    [
        eloRankingAlgorithm,
        winsRankingAlgorithm,
        transitiveRankingAlgorithm,
        manualRankingAlgorithm,
        copelandRankingAlgorithm,
        markovRankingAlgorithm,
        bradleyTerryRankingAlgorithm,
    ];

const rankingAlgorithmMap = new Map<MovieFaceoffSortMode, MovieFaceoffRankingAlgorithm>(
    MOVIE_FACEOFF_RANKING_ALGORITHMS.map((algorithm) => [algorithm.id, algorithm] as const)
);

export function getMovieFaceoffRankingAlgorithm(
    sortMode: MovieFaceoffSortMode
) {
    return rankingAlgorithmMap.get(sortMode) || eloRankingAlgorithm;
}

export function getMovieFaceoffRankedMovies(
    replay: MovieFaceoffReplayState,
    sortMode: MovieFaceoffSortMode
) {
    return getMovieFaceoffRankingAlgorithm(sortMode).rank(replay);
}
