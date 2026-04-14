import {
    MovieFaceoffMovie,
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';
import { FaceoffMovie } from '../services/movie-faceoff.service';
import { TargetedInsertionState } from './movie-faceoff-types';

function toFaceoffMovie(
    movie: Pick<MovieFaceoffMovie, 'id' | 'title' | 'posterPath' | 'releaseDate'>
): FaceoffMovie {
    return {
        id: movie.id,
        title: movie.title,
        poster_path: movie.posterPath,
        release_date: movie.releaseDate,
    };
}

export function createTargetedInsertionState(
    targetMovie: FaceoffMovie,
    visibleRankedMovies: MovieFaceoffRankedMovie[],
    sortMode: MovieFaceoffSortMode,
    comparisonsCompleted = 0,
    low = 0,
    high?: number
): TargetedInsertionState {
    const rankedSnapshot = visibleRankedMovies.filter(
        (movie) => movie.id !== targetMovie.id
    );
    const normalizedHigh = Math.max(
        0,
        Math.min(high ?? rankedSnapshot.length, rankedSnapshot.length)
    );
    const normalizedLow = Math.max(0, Math.min(low, normalizedHigh));

    if (!rankedSnapshot.length || normalizedLow >= normalizedHigh) {
        return {
            targetMovie,
            rankingSortMode: sortMode,
            rankedSnapshot,
            low: normalizedLow,
            high: normalizedHigh,
            pivotIndex: -1,
            pivotMovie: null,
            comparisonsCompleted,
            complete: true,
        };
    }

    const pivotIndex = Math.floor((normalizedLow + normalizedHigh) / 2);
    const pivotMovie = toFaceoffMovie(rankedSnapshot[pivotIndex]);

    return {
        targetMovie,
        rankingSortMode: sortMode,
        rankedSnapshot,
        low: normalizedLow,
        high: normalizedHigh,
        pivotIndex,
        pivotMovie,
        comparisonsCompleted,
        complete: false,
    };
}

export function advanceTargetedInsertion(
    session: TargetedInsertionState,
    winnerIsTarget: boolean
): { low: number; high: number; comparisonsCompleted: number } {
    const pivotIndex = session.pivotIndex;
    return {
        low: winnerIsTarget ? session.low : Math.min(session.high, pivotIndex + 1),
        high: winnerIsTarget ? pivotIndex : session.high,
        comparisonsCompleted: session.comparisonsCompleted + 1,
    };
}
