import {
    MovieFaceoffMovie,
    MovieFaceoffRankedMovie,
} from '../interfaces/movie-faceoff.interface';
import { FaceoffMovie } from '../services/movie-faceoff.service';
import {
    TargetedInsertionPhase,
    TargetedInsertionState,
} from './movie-faceoff-types';

function pickPivotInMiddleBand(low: number, high: number): number {
    const size = high - low;
    const bandStart = low + Math.floor(size / 3);
    const bandEnd = Math.max(bandStart + 1, low + Math.ceil((2 * size) / 3));
    return bandStart + Math.floor(Math.random() * (bandEnd - bandStart));
}

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
    comparisonsCompleted = 0,
    low = 0,
    high?: number,
    phase: TargetedInsertionPhase = 'pivot',
    initialSnapshotSize?: number
): TargetedInsertionState {
    const rankedSnapshot = visibleRankedMovies.filter(
        (movie) => movie.id !== targetMovie.id
    );
    const normalizedHigh = Math.max(
        0,
        Math.min(high ?? rankedSnapshot.length, rankedSnapshot.length)
    );
    const normalizedLow = Math.max(0, Math.min(low, normalizedHigh));
    const snapshotSize = initialSnapshotSize ?? rankedSnapshot.length;

    if (
        phase === 'pinned' ||
        !rankedSnapshot.length ||
        normalizedLow >= normalizedHigh
    ) {
        return {
            targetMovie,
            rankedSnapshot,
            low: normalizedLow,
            high: normalizedHigh,
            pivotIndex: -1,
            pivotMovie: null,
            comparisonsCompleted,
            complete: true,
            phase,
            initialSnapshotSize: snapshotSize,
        };
    }

    const pivotIndex = pickPivotInMiddleBand(normalizedLow, normalizedHigh);
    const pivotMovie = toFaceoffMovie(rankedSnapshot[pivotIndex]);

    return {
        targetMovie,
        rankedSnapshot,
        low: normalizedLow,
        high: normalizedHigh,
        pivotIndex,
        pivotMovie,
        comparisonsCompleted,
        complete: false,
        phase: 'pivot',
        initialSnapshotSize: snapshotSize,
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
