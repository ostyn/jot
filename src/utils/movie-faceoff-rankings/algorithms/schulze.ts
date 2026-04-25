import { MovieFaceoffRankingAlgorithm } from '../types';

export const schulzeRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'schulze',
    label: 'Schulze Method',
    description:
        'Builds the strongest chain of pairwise wins between every pair of movies and ranks by who wins each chain.\n\nMetric: number of other movies beaten via the strongest path.\n\nPros: principled cycle handling (used in real elections like Wikipedia and Debian). Cons: harder to explain than a single score; ignores margin sizes once a path is established.',
    rank: (replay) => {
        const ids = Array.from(replay.ratings.keys());
        const n = ids.length;
        if (!n) return [];

        const indexOf = new Map(ids.map((id, idx) => [id, idx] as const));

        // d[i][j] = number of votes where i beat j
        const d = Array.from({ length: n }, () => new Array<number>(n).fill(0));
        for (const event of replay.events) {
            const i = indexOf.get(event.winnerId);
            const j = indexOf.get(event.loserId);
            if (i === undefined || j === undefined) continue;
            d[i][j]++;
        }

        // p[i][j] = strength of the strongest path from i to j
        const p = Array.from({ length: n }, () => new Array<number>(n).fill(0));
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (i !== j && d[i][j] > d[j][i]) p[i][j] = d[i][j];
            }
        }

        // Floyd-Warshall widest-path
        for (let k = 0; k < n; k++) {
            for (let i = 0; i < n; i++) {
                if (i === k) continue;
                for (let j = 0; j < n; j++) {
                    if (j === i || j === k) continue;
                    const candidate = Math.min(p[i][k], p[k][j]);
                    if (candidate > p[i][j]) p[i][j] = candidate;
                }
            }
        }

        return ids
            .map((id, i) => {
                let beats = 0;
                for (let j = 0; j < n; j++) {
                    if (i !== j && p[i][j] > p[j][i]) beats++;
                }
                return { ...replay.ratings.get(id)!, score: beats };
            })
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    },
    formatMetric: (movie) => `beats ${movie.score} via strongest path`,
};
