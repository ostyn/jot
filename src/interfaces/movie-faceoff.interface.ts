export const MOVIE_FACEOFF_SORT_MODES = [
    'rrf',
    'trimmed-mean',
    'elo',
    'glicko',
    'bradley-terry',
    'manual',
    'copeland',
    'transitive',
    'markov',
    'wins',
    'uncertainty',
    'alphabetical',
    'release-date',
    'most-compared',
] as const;

export type MovieFaceoffSortMode = (typeof MOVIE_FACEOFF_SORT_MODES)[number];

export interface MovieFaceoffEvent {
    id?: number;
    createdAt: string;
    type: 'vote';
    winnerId: number;
    loserId: number;
    targetId?: number;
}

export interface MovieFaceoffMovie {
    id: number;
    title: string;
    posterPath?: string;
    releaseDate?: string;
    excludedAt?: string;
    unseenAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface MovieFaceoffExportData {
    events: MovieFaceoffEvent[];
    movies: MovieFaceoffMovie[];
}

export interface MovieFaceoffRankedMovie extends MovieFaceoffMovie {
    rating: number;
    glickoRating?: number;
    winCount: number;
    lossCount: number;
    score?: number;
    ratingDeviation?: number; // Glicko rating deviation (uncertainty)
    ratingVolatility?: number; // Glicko rating volatility (stability)
}
