import { MovieFaceoffRankedMovie } from '../../../interfaces/movie-faceoff.interface';
import { MovieFaceoffRankingAlgorithm } from '../types';
import { rankBySchulzePaths } from './schulze';

export const consensusSchulzeRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'consensus-schulze',
    label: 'Schulze Consensus',
    description:
        'Aggregate: treats each non-aggregate method as a voter casting a ranked ballot, then runs the Schulze method on those ballots to produce a consensus ranking.\n\nMetric: number of other movies beaten via the strongest consensus path.\n\nPros: principled cycle handling at the algorithm level — when methods disagree, the strongest chain of agreement wins. Cons: the heaviest aggregate to compute; opaque if you do not already understand Schulze.',
    isAggregate: true,
    rank: (replay, primaryAlgorithms) => {
        const algorithms = (primaryAlgorithms || []).filter(
            (a) => !a.isAggregate && !a.isInformational
        );
        if (!algorithms.length) return [];

        const movieById = new Map<number, MovieFaceoffRankedMovie>();
        const ranksPerAlgorithm: Map<number, number>[] = [];
        const allIds = new Set<number>();

        for (const algorithm of algorithms) {
            const ranked = algorithm.rank(replay);
            const rankMap = new Map<number, number>();
            ranked.forEach((movie, index) => {
                rankMap.set(movie.id, index);
                allIds.add(movie.id);
                if (!movieById.has(movie.id)) movieById.set(movie.id, movie);
            });
            ranksPerAlgorithm.push(rankMap);
        }

        const ids = Array.from(allIds);
        const n = ids.length;
        if (!n) return [];

        // d[i][j] = number of primary algorithms that rank i above j.
        const d = new Int32Array(n * n);
        for (const rankMap of ranksPerAlgorithm) {
            for (let i = 0; i < n; i++) {
                const rankI = rankMap.get(ids[i]);
                if (rankI === undefined) continue;
                const rowI = i * n;
                for (let j = 0; j < n; j++) {
                    if (i === j) continue;
                    const rankJ = rankMap.get(ids[j]);
                    if (rankJ === undefined) continue;
                    if (rankI < rankJ) d[rowI + j]++;
                }
            }
        }

        return rankBySchulzePaths(ids, d, movieById);
    },
    formatMetric: (movie) => `beats ${movie.score} via consensus path`,
};
