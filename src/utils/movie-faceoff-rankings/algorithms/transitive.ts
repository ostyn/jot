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
        'Credits movies for direct wins and the wins of movies they beat.\n\nMetric: total reachable wins in the comparison graph.\n\nPros: can surface strong movies from sparse data. Cons: can amplify noisy chains.',
    rank: computeTransitiveScores,
    formatMetric: (movie) => `${movie.score} wins`,
};
