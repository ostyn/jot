import { MovieFaceoffRankingAlgorithm } from '../types';

function releaseTimestamp(releaseDate?: string): number {
    if (!releaseDate) return Number.NEGATIVE_INFINITY;
    const parsed = Date.parse(releaseDate);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

export const releaseDateRankingAlgorithm: MovieFaceoffRankingAlgorithm = {
    id: 'release-date',
    label: 'Release Date (Newest)',
    description:
        "Sorts movies by theatrical release date, newest first. Movies without a release date fall to the bottom, then tie-break on title.\n\nMetric: the release date shown as YYYY-MM-DD.\n\nInformational only — does not contribute to aggregate rankings.",
    isInformational: true,
    rank: (replay) =>
        Array.from(replay.ratings.values()).sort((a, b) => {
            const diff = releaseTimestamp(b.releaseDate) - releaseTimestamp(a.releaseDate);
            if (diff !== 0) return diff;
            return a.title.localeCompare(b.title);
        }),
    formatMetric: (movie) => movie.releaseDate || 'Unknown',
};
