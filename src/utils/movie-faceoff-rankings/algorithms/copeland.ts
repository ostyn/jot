import { MovieFaceoffRankingAlgorithm } from '../types';

export const copelandRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'copeland',
    label: 'Copeland Score',
    description:
        'Copeland Score compares each movie against every other ranked movie and gives it one point for each opponent it beats and minus one point for each opponent that beats it. In practice, it asks how many pairwise relationships a movie comes out ahead on overall.\n\nThat makes it good for summarizing head-to-head dominance across the pool, but it treats all wins equally and does not care whether a result was expected, recent, or built on a large amount of evidence.',
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
