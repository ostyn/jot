import { MovieFaceoffRankingAlgorithm } from '../types';

export const alphabeticalRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'alphabetical',
    label: 'Title (A–Z)',
    description:
        'Sorts movies alphabetically by title using locale-aware comparison.\n\nMetric: none — position reflects title order.\n\nInformational only — does not contribute to aggregate rankings.',
    isInformational: true,
    rank: (replay) =>
        Array.from(replay.ratings.values()).sort((a, b) =>
            a.title.localeCompare(b.title)
        ),
    formatMetric: () => '',
};
