import { memoizeByReplay } from '../replay-cache';
import { MovieFaceoffRankingAlgorithm } from '../types';

const rankSchulze = memoizeByReplay((replay) => {
    const ids = Array.from(replay.ratings.keys());
    const n = ids.length;
    if (!n) return [];

    const indexOf = new Map(ids.map((id, idx) => [id, idx] as const));

    // Flat n×n matrices for cache-friendly access. Vote counts and path
    // strengths are non-negative integers that comfortably fit in Int32.
    const d = new Int32Array(n * n);
    const p = new Int32Array(n * n);

    for (const event of replay.events) {
        const i = indexOf.get(event.winnerId);
        const j = indexOf.get(event.loserId);
        if (i === undefined || j === undefined) continue;
        d[i * n + j]++;
    }

    // Initial path strengths: only the dominant direction of each pair.
    for (let i = 0; i < n; i++) {
        const rowI = i * n;
        for (let j = 0; j < n; j++) {
            if (i === j) continue;
            const dij = d[rowI + j];
            if (dij > d[j * n + i]) p[rowI + j] = dij;
        }
    }

    // Floyd-Warshall widest-path. The skip-zero shortcut is the big win on
    // sparse graphs: if p[i][k] is 0, every candidate min(p[i][k], …) is 0
    // and can never improve p[i][j], so the entire inner j loop is dead.
    for (let k = 0; k < n; k++) {
        const rowK = k * n;
        for (let i = 0; i < n; i++) {
            if (i === k) continue;
            const rowI = i * n;
            const pIK = p[rowI + k];
            if (pIK === 0) continue;
            for (let j = 0; j < n; j++) {
                if (j === i || j === k) continue;
                const pKJ = p[rowK + j];
                const candidate = pIK < pKJ ? pIK : pKJ;
                if (candidate > p[rowI + j]) p[rowI + j] = candidate;
            }
        }
    }

    return ids
        .map((id, i) => {
            const rowI = i * n;
            let beats = 0;
            for (let j = 0; j < n; j++) {
                if (i !== j && p[rowI + j] > p[j * n + i]) beats++;
            }
            return { ...replay.ratings.get(id)!, score: beats };
        })
        .sort((a, b) => (b.score || 0) - (a.score || 0));
});

export const schulzeRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'schulze',
    label: 'Schulze Method',
    description:
        'Builds the strongest chain of pairwise wins between every pair of movies and ranks by who wins each chain.\n\nMetric: number of other movies beaten via the strongest path.\n\nPros: principled cycle handling (used in real elections like Wikipedia and Debian). Cons: harder to explain than a single score; ignores margin sizes once a path is established.',
    rank: rankSchulze,
    formatMetric: (movie) => `beats ${movie.score} via strongest path`,
};
