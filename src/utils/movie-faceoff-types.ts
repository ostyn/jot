import { MovieFaceoffRankedMovie } from '../interfaces/movie-faceoff.interface';
import { FaceoffMovie } from '../services/movie-faceoff.service';

export type FaceoffPair = [FaceoffMovie | null, FaceoffMovie | null];
export type UndoAction =
    | 'vote'
    | 'not-seen-left'
    | 'not-seen-right'
    | 'not-seen-both'
    | 'exclude'
    | 'restore-excluded';

export type MovieStateChange = {
    movieId: number;
    previousExcludedAt?: string;
    previousUnseenAt?: string;
};

export type UndoEntry = {
    action: UndoAction;
    eventId?: number;
    movieChanges?: MovieStateChange[];
    pair: FaceoffPair;
    targetedInsertion?: TargetedInsertionState | null;
};

export type TargetedInsertionPhase = 'pivot' | 'pinned';

export type TargetedInsertionState = {
    targetMovie: FaceoffMovie;
    rankedSnapshot: MovieFaceoffRankedMovie[];
    low: number;
    high: number;
    pivotIndex: number;
    pivotMovie: FaceoffMovie | null;
    comparisonsCompleted: number;
    complete: boolean;
    phase: TargetedInsertionPhase;
    initialSnapshotSize: number;
    /** Rank position where the pivot phase converged. Set transiently when
     * transitioning pivot→pinned; cleared on the next vote. */
    lastPivotedRank?: number;
};

export const MAX_UNDO_ENTRIES = 25;
export const UNDO_STACK_STORAGE_KEY = 'movie-faceoff-undo-stack-v2';

export function clonePair(pair: FaceoffPair): FaceoffPair {
    return pair.map((movie) => (movie ? { ...movie } : null)) as FaceoffPair;
}

function isFaceoffMovie(candidate: unknown): candidate is FaceoffMovie {
    if (!candidate || typeof candidate !== 'object') return false;
    const movie = candidate as Partial<FaceoffMovie>;
    return typeof movie.id === 'number' && typeof movie.title === 'string';
}

function isMovieStateChange(candidate: unknown): candidate is MovieStateChange {
    if (!candidate || typeof candidate !== 'object') return false;
    const change = candidate as Partial<MovieStateChange>;
    return typeof change.movieId === 'number';
}

export function isUndoEntry(entry: unknown): entry is UndoEntry {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Partial<UndoEntry>;
    return Boolean(
        [
            'vote',
            'not-seen-left',
            'not-seen-right',
            'not-seen-both',
            'exclude',
            'restore-excluded',
        ].includes(candidate.action || '') &&
            Array.isArray(candidate.pair) &&
            candidate.pair.length === 2 &&
            candidate.pair.every(
                (movie) => movie === null || isFaceoffMovie(movie)
            ) &&
            (candidate.movieChanges === undefined ||
                (Array.isArray(candidate.movieChanges) &&
                    candidate.movieChanges.every(isMovieStateChange)))
    );
}
