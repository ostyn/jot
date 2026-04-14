import { MovieFaceoffRankingAlgorithm } from '../types';

export const copelandRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'copeland',
    label: 'Copeland Score',
    description:
        'Compares each movie pairwise and scores wins minus losses.\n\nMetric: net pairwise wins.\n\nPros: easy summary of head-to-head dominance. Cons: treats all wins equally.',
    rank: (replay) => {
        const ids = Array.from(replay.ratings.keys());

        return ids
            .map((id) => {
                let wins = 0;
                let losses = 0;

                for (const otherId of ids) {
                    if (id === otherId) continue;
                    if (replay.beatMap.get(id)?.has(otherId)) wins++;
                    if (replay.beatMap.get(otherId)?.has(id)) losses++;
                }

                return {
                    ...replay.ratings.get(id)!,
                    score: wins - losses,
                };
            })
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    },
    formatMetric: (movie) => `${movie.score} net wins`,
};
