export const MOVIE_FACEOFF_SORT_MODES = [
    'elo',
    'wins',
    'transitive',
    'manual',
    'copeland',
    'markov',
    'bradley-terry',
] as const;

export type MovieFaceoffSortMode = (typeof MOVIE_FACEOFF_SORT_MODES)[number];

export interface MovieFaceoffEvent {
    id?: number;
    createdAt: string;
    type: 'vote';
    winnerId: number;
    loserId: number;
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
    winCount: number;
    lossCount: number;
    score?: number;
}
