import {
    MovieFaceoffRankedMovie,
} from '../../../interfaces/movie-faceoff.interface';
import { MovieFaceoffRankingAlgorithm, MovieFaceoffReplayState } from '../types';

function computeTransitiveScores(
    replay: MovieFaceoffReplayState
): MovieFaceoffRankedMovie[] {
    const scores = new Map<number, number>();
    const visitedCache = new Map<number, number>();

    const dfs = (id: number, visited = new Set<number>()): number => {
        if (visitedCache.has(id)) return visitedCache.get(id)!;
        const beatSet = replay.beatMap.get(id);
        if (!beatSet?.size) return 0;
        visited.add(id);
        let count = 0;
        for (const defeated of beatSet) {
            if (!visited.has(defeated)) {
                count += 1 + dfs(defeated, visited);
            }
        }
        visitedCache.set(id, count);
        return count;
    };

    for (const [id] of replay.ratings) {
        scores.set(id, dfs(id, new Set<number>()));
    }

    return Array.from(scores.entries())
        .map(([id, score]) => ({ ...replay.ratings.get(id)!, score }))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
}

export const transitiveRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'transitive',
    label: 'Transitive Rank',
    description:
        'Transitive Rank rewards a movie not only for direct wins, but also for the downstream strength of the movies it has beaten. If Movie A beat Movie B, and Movie B beat several others, A gets credit for sitting above that chain.\n\nThis can surface strong movies from sparse data, but it can also amplify noisy paths, so it is most useful when you want to explore the structure of the head-to-head graph rather than rely on a conservative score.',
    rank: computeTransitiveScores,
    formatMetric: (movie) => `${movie.score} wins`,
};
