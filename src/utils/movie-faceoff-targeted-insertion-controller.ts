import {
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';
import { FaceoffMovie } from '../services/movie-faceoff.service';
import {
    advanceTargetedInsertion,
    createTargetedInsertionState,
} from './movie-faceoff-targeted-insertion';
import {
    FaceoffPair,
    TargetedInsertionPhase,
    TargetedInsertionState,
} from './movie-faceoff-types';
import { updateMovieFaceoffQueryParams } from './movie-faceoff-url-sync';

const PIVOT_SNAPSHOT_SORT: MovieFaceoffSortMode = 'manual';

export interface MovieFaceoffTargetedInsertionAdapter {
    getSession: () => TargetedInsertionState | null;
    setSession: (next: TargetedInsertionState | null) => void;
    setPendingTargetMovieId: (id: number | undefined) => void;
    getRankedSnapshotForSort: (
        sortMode: MovieFaceoffSortMode
    ) => MovieFaceoffRankedMovie[];
    hasPriorVotes: (movieId: number) => boolean;
    setModeIdSilent: (modeId: string) => void;
    setStatusMessage: (message: string) => void;
    setErrorMessage: (message: string) => void;
    setMovies: (movies: FaceoffPair) => void;
    syncPairToUrl: () => void;
    displayNewPair: () => Promise<void>;
    upsertMoviesMetadata: (movies: FaceoffMovie[]) => Promise<void>;
    fetchMovie: (id: number) => Promise<FaceoffMovie>;
}

export interface RefreshOptions {
    comparisonsCompleted?: number;
    low?: number;
    high?: number;
    preserveCurrentPair?: boolean;
}

export class MovieFaceoffTargetedInsertionController {
    constructor(private adapter: MovieFaceoffTargetedInsertionAdapter) {}

    private buildState(
        targetMovie: FaceoffMovie,
        comparisonsCompleted = 0,
        low = 0,
        high?: number,
        phase: TargetedInsertionPhase = 'pivot',
        initialSnapshotSize?: number
    ): TargetedInsertionState {
        return createTargetedInsertionState(
            targetMovie,
            this.adapter.getRankedSnapshotForSort(PIVOT_SNAPSHOT_SORT),
            comparisonsCompleted,
            low,
            high,
            phase,
            initialSnapshotSize
        );
    }

    private clearSessionState() {
        this.adapter.setSession(null);
        this.adapter.setPendingTargetMovieId(undefined);
        updateMovieFaceoffQueryParams({ targetMovieId: undefined });
    }

    async start(movie: FaceoffMovie): Promise<void> {
        await this.adapter.upsertMoviesMetadata([movie]);
        // Targeted mode is anchored to the user's ranked pool — pivots and
        // pinned-mode opponents both come from "My movies."
        this.adapter.setModeIdSilent('ranked');
        this.adapter.setErrorMessage('');

        const snapshot = this.adapter.getRankedSnapshotForSort(
            PIVOT_SNAPSHOT_SORT
        );
        const candidateCount = snapshot.filter(
            (other) => other.id !== movie.id
        ).length;
        const skipPivot = this.adapter.hasPriorVotes(movie.id);
        // No candidates → straight to pinned (smart pairing reports the
        // empty-pool error). Already-ranked target → skip pivot.
        const phase: TargetedInsertionPhase =
            skipPivot || candidateCount === 0 ? 'pinned' : 'pivot';

        const nextState = this.buildState(movie, 0, 0, undefined, phase);
        this.adapter.setSession(nextState);

        if (phase === 'pinned') {
            if (candidateCount === 0) {
                this.adapter.setStatusMessage(
                    'Saved that movie. Rank a few movies first, then use targeted placement.'
                );
                this.adapter.setErrorMessage(
                    'Targeted placement needs at least one ranked movie to compare against.'
                );
            } else {
                this.adapter.setStatusMessage(`Pinned ${movie.title}.`);
            }
            await this.adapter.displayNewPair();
            return;
        }

        this.adapter.setStatusMessage(`Placing ${movie.title}.`);
        this.adapter.setMovies([movie, nextState.pivotMovie]);
        this.adapter.syncPairToUrl();
    }

    async refresh(options: RefreshOptions = {}): Promise<void> {
        const session = this.adapter.getSession();
        if (!session) return;

        if (session.phase === 'pinned') {
            // Pinned mode: route handles pair selection via displayNewPair.
            if (!options.preserveCurrentPair) {
                await this.adapter.displayNewPair();
            }
            return;
        }

        const nextState = this.buildState(
            session.targetMovie,
            options.comparisonsCompleted ?? session.comparisonsCompleted,
            options.low ?? session.low,
            options.high ?? session.high,
            'pivot',
            session.initialSnapshotSize
        );

        if (nextState.complete) {
            // Pivot converged — transition to pinned without clearing.
            const pinnedState = this.buildState(
                session.targetMovie,
                nextState.comparisonsCompleted,
                nextState.low,
                nextState.high,
                'pinned',
                session.initialSnapshotSize
            );
            pinnedState.lastPivotedRank = nextState.low + 1;
            this.adapter.setSession(pinnedState);
            this.adapter.setStatusMessage(
                `Pinned ${session.targetMovie.title}.`
            );
            await this.adapter.displayNewPair();
            return;
        }

        this.adapter.setSession(nextState);
        if (!options.preserveCurrentPair) {
            this.adapter.setMovies([nextState.targetMovie, nextState.pivotMovie]);
            this.adapter.syncPairToUrl();
        }
    }

    async advanceAfterVote(winnerIsLeft: boolean): Promise<boolean> {
        const session = this.adapter.getSession();
        if (!session) return false;
        if (session.phase === 'pinned') {
            // Drop the transient "just-placed" annotation before the next
            // pair renders. Let the route's normal post-vote flow drive
            // the next pair — displayNewPair sees the pinned phase and
            // pairs target-vs-smart.
            if (session.lastPivotedRank !== undefined) {
                this.adapter.setSession({
                    ...session,
                    lastPivotedRank: undefined,
                });
            }
            return false;
        }
        const { low, high, comparisonsCompleted } = advanceTargetedInsertion(
            session,
            winnerIsLeft
        );
        await this.refresh({ comparisonsCompleted, low, high });
        return true;
    }

    cancel(): void {
        const session = this.adapter.getSession();
        if (!session) return;
        const targetTitle = session.targetMovie.title;
        this.clearSessionState();
        this.adapter.setStatusMessage(`Unpinned ${targetTitle}.`);
        void this.adapter.displayNewPair();
    }

    clearForTargetRemoved(movieId: number): boolean {
        const session = this.adapter.getSession();
        if (session?.targetMovie.id !== movieId) return false;
        this.clearSessionState();
        return true;
    }

    clearSilent(): void {
        if (!this.adapter.getSession()) return;
        this.clearSessionState();
    }

    async maybeStartFromUrl(pendingTargetMovieId: number | undefined): Promise<boolean> {
        if (!pendingTargetMovieId) return false;
        const session = this.adapter.getSession();
        if (session?.targetMovie.id === pendingTargetMovieId) return true;

        try {
            const movie = await this.adapter.fetchMovie(pendingTargetMovieId);
            await this.start(movie);
            return true;
        } catch (error) {
            this.adapter.setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to start targeted placement.'
            );
            return false;
        }
    }
}
