import { MovieFaceoffRankingAlgorithm } from '../types';

function computeBradleyTerryScores(
    iterations = 100,
    learningRate = 0.01
): MovieFaceoffRankingAlgorithm['rank'] {
    return (replay) => {
        const ids = Array.from(replay.ratings.keys());
        if (!ids.length) return [];

        const strengths = new Map<number, number>(
            ids.map((id) => [id, 0] as const)
        );
        const outcomes: Array<[number, number]> = [];

        for (const [winnerId, loserIds] of replay.beatMap.entries()) {
            for (const loserId of loserIds) {
                outcomes.push([winnerId, loserId]);
            }
        }

        for (let iteration = 0; iteration < iterations; iteration++) {
            for (const [winnerId, loserId] of outcomes) {
                const winnerStrength = Math.exp(strengths.get(winnerId) || 0);
                const loserStrength = Math.exp(strengths.get(loserId) || 0);
                const denominator = winnerStrength + loserStrength;
                strengths.set(
                    winnerId,
                    (strengths.get(winnerId) || 0) +
                        learningRate * (1 - winnerStrength / denominator)
                );
                strengths.set(
                    loserId,
                    (strengths.get(loserId) || 0) +
                        learningRate * (-loserStrength / denominator)
                );
            }
        }

        return ids
            .map((id) => ({
                ...replay.ratings.get(id)!,
                score: Math.exp(strengths.get(id) || 0),
            }))
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    };
}

export const bradleyTerryRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'bradley-terry',
    label: 'Bradley-Terry Ranking',
    description:
        'Bradley-Terry estimates an underlying strength for each movie that best explains the observed head-to-head wins and losses. Instead of just counting outcomes, it tries to fit a probabilistic model of how likely each movie is to beat another.\n\nIt is one of the more principled pairwise-comparison methods here, especially once you have enough data, but it can feel less transparent than simpler rankings when you are trying to understand a single surprising placement.',
    rank: computeBradleyTerryScores(),
    formatMetric: (movie) => `${(movie.score || 0).toFixed(2)}%`,
};
