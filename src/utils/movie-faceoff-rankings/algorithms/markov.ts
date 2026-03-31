import { MovieFaceoffRankingAlgorithm } from '../types';

function computeMarkovScores(iterations = 50, damping = 0.85): MovieFaceoffRankingAlgorithm['rank'] {
    return (replay) => {
        const ids = Array.from(replay.ratings.keys());
        if (!ids.length) return [];

        const reverseEdges = new Map<number, Set<number>>();
        ids.forEach((id) => reverseEdges.set(id, new Set<number>()));

        for (const [winnerId, loserIds] of replay.beatMap.entries()) {
            for (const loserId of loserIds) {
                if (!reverseEdges.has(loserId)) reverseEdges.set(loserId, new Set());
                reverseEdges.get(loserId)?.add(winnerId);
            }
        }

        const index = new Map(ids.map((id, idx) => [id, idx] as const));
        const matrix = Array.from({ length: ids.length }, () =>
            new Array<number>(ids.length).fill(0)
        );

        for (let i = 0; i < ids.length; i++) {
            const fromId = ids[i];
            const toSet = reverseEdges.get(fromId);
            if (!toSet?.size) continue;

            const share = 1 / toSet.size;
            for (const toId of toSet) {
                const j = index.get(toId);
                if (j !== undefined) matrix[i][j] = share;
            }
        }

        const rank = new Array<number>(ids.length).fill(1 / ids.length);
        const temp = new Array<number>(ids.length).fill(0);

        for (let iteration = 0; iteration < iterations; iteration++) {
            for (let j = 0; j < ids.length; j++) {
                temp[j] = (1 - damping) / ids.length;
            }

            for (let i = 0; i < ids.length; i++) {
                for (let j = 0; j < ids.length; j++) {
                    temp[j] += damping * rank[i] * matrix[i][j];
                }
            }

            rank.splice(0, ids.length, ...temp);
        }

        return ids
            .map((id, idx) => ({
                ...replay.ratings.get(id)!,
                score: rank[idx],
            }))
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    };
}

export const markovRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'markov',
    label: 'Markov Ranking',
    description:
        'Markov Ranking treats the results as a network and repeatedly moves ranking weight through that network until it stabilizes. A movie gains value not just from its own wins, but from being connected to other strong movies in the graph.\n\nThis gives a more global picture than a direct score, which can be useful when the matchup web is dense, but the result is also more abstract and usually less intuitive to explain at a glance.',
    rank: computeMarkovScores(),
    formatMetric: (movie) => `${((movie.score || 0) * 100).toFixed(2)}%`,
};
