import {
    MOVIE_FACEOFF_RANKING_ALGORITHMS,
    MovieFaceoffRankingAlgorithm,
    MovieFaceoffReplayState,
} from './movie-faceoff-rankings';

export type RankingSnapshot = {
    algorithm: MovieFaceoffRankingAlgorithm;
    rank: number | null;
    total: number;
    percentile: number | null;
    metric: string;
};

export function buildRankingSnapshots(
    movieId: number,
    replay: MovieFaceoffReplayState
): RankingSnapshot[] {
    return MOVIE_FACEOFF_RANKING_ALGORITHMS.filter(
        (algorithm) => !algorithm.isInformational || algorithm.id === 'uncertainty'
    ).map((algorithm) => {
        const ranked = algorithm
            .rank(replay, MOVIE_FACEOFF_RANKING_ALGORITHMS)
            .filter((movie) => !movie.excludedAt && !movie.unseenAt);
        const index = ranked.findIndex((movie) => movie.id === movieId);
        const rankedMovie = index === -1 ? undefined : ranked[index];
        const total = ranked.length;
        const rank = index === -1 ? null : index + 1;
        const percentile =
            rank === null || total <= 1 ? null : (rank - 1) / (total - 1);

        return {
            algorithm,
            rank,
            total,
            percentile,
            metric: rankedMovie
                ? algorithm.formatMetric(rankedMovie)
                : 'Not ranked yet',
        };
    });
}

export function getChartSnapshots(snapshots: RankingSnapshot[]): RankingSnapshot[] {
    return snapshots.filter((s) => s.algorithm.id !== 'uncertainty');
}

export function getUncertaintySnapshot(
    snapshots: RankingSnapshot[]
): RankingSnapshot | undefined {
    return snapshots.find((s) => s.algorithm.id === 'uncertainty');
}

export function getHeadlineSnapshot(
    snapshots: RankingSnapshot[]
): RankingSnapshot | undefined {
    return snapshots.find((s) => s.algorithm.id === 'rrf');
}

export function computeRankRange(
    snapshots: RankingSnapshot[]
): { min: number; max: number } | null {
    const ranks = snapshots
        .filter((s) => !s.algorithm.isAggregate && !s.algorithm.isInformational)
        .map((s) => s.rank)
        .filter((r): r is number => r !== null);
    if (!ranks.length) return null;
    return { min: Math.min(...ranks), max: Math.max(...ranks) };
}
