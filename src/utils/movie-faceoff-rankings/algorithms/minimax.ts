import { MovieFaceoffRankingAlgorithm } from '../types';

export const minimaxRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'minimax',
    label: 'Minimax',
    description:
        "Judges each movie by its single worst pairwise loss — the largest margin by which any opponent has beaten it.\n\nMetric: worst loss margin (closer to zero is better).\n\nPros: pessimistic counterpart to win-counting algorithms; rewards consistency. Cons: ignores total wins; one bad matchup dominates the score.",
    rank: (replay) => {
        const ids = Array.from(replay.ratings.keys());
        const n = ids.length;
        if (!n) return [];

        const indexOf = new Map(ids.map((id, idx) => [id, idx] as const));

        const d = Array.from({ length: n }, () => new Array<number>(n).fill(0));
        for (const event of replay.events) {
            const i = indexOf.get(event.winnerId);
            const j = indexOf.get(event.loserId);
            if (i === undefined || j === undefined) continue;
            d[i][j]++;
        }

        return ids
            .map((id, i) => {
                let worstLossMargin = 0;
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const margin = d[j][i] - d[i][j];
                    if (margin > worstLossMargin) worstLossMargin = margin;
                }
                return {
                    ...replay.ratings.get(id)!,
                    score: worstLossMargin === 0 ? 0 : -worstLossMargin,
                };
            })
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    },
    formatMetric: (movie) => {
        const worst = -(movie.score || 0);
        return worst === 0 ? 'no losing margin' : `worst loss by ${worst}`;
    },
};
