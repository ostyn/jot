import { MovieFaceoffSortMode } from '../../interfaces/movie-faceoff.interface';
import { alphabeticalRankingAlgorithm } from './algorithms/alphabetical';
import { bordaRankingAlgorithm } from './algorithms/borda';
import { bradleyTerryRankingAlgorithm } from './algorithms/bradley-terry';
import { consensusSchulzeRankingAlgorithm } from './algorithms/consensus-schulze';
import { uncertaintyRankingAlgorithm } from './algorithms/uncertainty';
import { copelandRankingAlgorithm } from './algorithms/copeland';
import { eloRankingAlgorithm } from './algorithms/elo';
import { glickoRankingAlgorithm } from './algorithms/glicko';
import { manualRankingAlgorithm } from './algorithms/manual';
import { markovRankingAlgorithm } from './algorithms/markov';
import { mostComparedRankingAlgorithm } from './algorithms/most-compared';
import { releaseDateRankingAlgorithm } from './algorithms/release-date';
import { rrfRankingAlgorithm } from './algorithms/rrf';
import { schulzeRankingAlgorithm } from './algorithms/schulze';
import { trimmedMeanRankingAlgorithm } from './algorithms/trimmed-mean';
import { winsRankingAlgorithm } from './algorithms/wins';
import { MovieFaceoffRankingAlgorithm, MovieFaceoffReplayState } from './types';

export * from './types';
export { buildMovieFaceoffReplayState } from './replay-state';

export const MOVIE_FACEOFF_RANKING_ALGORITHMS: readonly MovieFaceoffRankingAlgorithm[] =
    [
        rrfRankingAlgorithm,
        trimmedMeanRankingAlgorithm,
        bordaRankingAlgorithm,
        consensusSchulzeRankingAlgorithm,
        eloRankingAlgorithm,
        glickoRankingAlgorithm,
        bradleyTerryRankingAlgorithm,
        manualRankingAlgorithm,
        copelandRankingAlgorithm,
        schulzeRankingAlgorithm,
        markovRankingAlgorithm,
        uncertaintyRankingAlgorithm,
        winsRankingAlgorithm,
        mostComparedRankingAlgorithm,
        releaseDateRankingAlgorithm,
        alphabeticalRankingAlgorithm,
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
    return getMovieFaceoffRankingAlgorithm(sortMode).rank(
        replay,
        MOVIE_FACEOFF_RANKING_ALGORITHMS
    );
}
