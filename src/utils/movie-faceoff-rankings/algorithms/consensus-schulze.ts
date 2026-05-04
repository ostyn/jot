import { getPairwiseDisagreement } from '../pairwise-disagreement';
import { MovieFaceoffRankingAlgorithm } from '../types';
import { rankBySchulzePaths } from './schulze';

export const consensusSchulzeRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'consensus-schulze',
    label: 'Schulze Consensus',
    description:
        'Aggregate: treats each non-aggregate method as a voter casting a ranked ballot, then runs the Schulze method on those ballots to produce a consensus ranking.\n\nMetric: number of other movies beaten via the strongest consensus path.\n\nPros: principled cycle handling at the algorithm level — when methods disagree, the strongest chain of agreement wins. Cons: the heaviest aggregate to compute; opaque if you do not already understand Schulze.',
    isAggregate: true,
    rank: (replay, primaryAlgorithms) => {
        const matrix = getPairwiseDisagreement(replay, primaryAlgorithms || []);
        if (!matrix.n) return [];
        return rankBySchulzePaths(matrix.ids, matrix.d, matrix.movieById);
    },
    formatMetric: (movie) => `beats ${movie.score} via consensus path`,
};
