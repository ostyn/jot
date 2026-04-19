import {
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';
import { FaceoffMovie } from '../services/movie-faceoff.service';
import { getMovieFaceoffRankingAlgorithm } from './movie-faceoff-rankings';
import {
    advanceTargetedInsertion,
    createTargetedInsertionState,
} from './movie-faceoff-targeted-insertion';
import { FaceoffPair, TargetedInsertionState } from './movie-faceoff-types';
import { updateMovieFaceoffQueryParams } from './movie-faceoff-url-sync';

export interface MovieFaceoffTargetedInsertionAdapter {
    getSession: () => TargetedInsertionState | null;
    setSession: (next: TargetedInsertionState | null) => void;
    setPendingTargetMovieId: (id: number | undefined) => void;
    getRankedSnapshot: () => MovieFaceoffRankedMovie[];
    getSortMode: () => MovieFaceoffSortMode;
    switchToManualSort: () => void;
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
        high?: number
    ): TargetedInsertionState {
        return createTargetedInsertionState(
            targetMovie,
            this.adapter.getRankedSnapshot(),
            this.adapter.getSortMode(),
            comparisonsCompleted,
            low,
            high
        );
    }

    private clearSessionState() {
        this.adapter.setSession(null);
        this.adapter.setPendingTargetMovieId(undefined);
        updateMovieFaceoffQueryParams({ targetMovieId: undefined });
    }

    async start(movie: FaceoffMovie): Promise<void> {
        await this.adapter.upsertMoviesMetadata([movie]);

        this.adapter.switchToManualSort();
        const nextState = this.buildState(movie);
        this.adapter.setSession(nextState);

        if (nextState.complete) {
            const hasRankings = nextState.rankedSnapshot.length > 0;
            this.clearSessionState();
            this.adapter.setStatusMessage(
                hasRankings
                    ? `Placed ${movie.title} at #${nextState.low + 1} in ${getMovieFaceoffRankingAlgorithm(this.adapter.getSortMode()).label}.`
                    : 'Saved that movie. Rank a few movies first, then use targeted placement.'
            );
            await this.adapter.displayNewPair();
            this.adapter.setErrorMessage(
                hasRankings
                    ? ''
                    : 'Targeted placement needs at least one ranked movie to compare against.'
            );
            return;
        }

        this.adapter.setStatusMessage(
            `Placing ${movie.title} using ${getMovieFaceoffRankingAlgorithm(this.adapter.getSortMode()).label}.`
        );
        this.adapter.setErrorMessage('');
        this.adapter.setMovies([movie, nextState.pivotMovie]);
        this.adapter.syncPairToUrl();
    }

    async refresh(options: RefreshOptions = {}): Promise<void> {
        const session = this.adapter.getSession();
        if (!session) return;

        const nextState = this.buildState(
            session.targetMovie,
            options.comparisonsCompleted ?? session.comparisonsCompleted,
            options.low ?? session.low,
            options.high ?? session.high
        );

        this.adapter.setSession(nextState);

        if (nextState.complete) {
            const estimatedPlacement = Math.min(
                nextState.rankedSnapshot.length + 1,
                nextState.low + 1
            );
            this.clearSessionState();
            this.adapter.setStatusMessage(
                nextState.rankedSnapshot.length
                    ? `Placed ${nextState.targetMovie.title} at #${estimatedPlacement} in ${getMovieFaceoffRankingAlgorithm(this.adapter.getSortMode()).label}.`
                    : 'Saved that movie. Rank a few movies first, then use targeted placement.'
            );
            await this.adapter.displayNewPair();
            return;
        }

        if (!options.preserveCurrentPair) {
            this.adapter.setMovies([nextState.targetMovie, nextState.pivotMovie]);
            this.adapter.syncPairToUrl();
        }
    }

    async advanceAfterVote(winnerIsLeft: boolean): Promise<boolean> {
        const session = this.adapter.getSession();
        if (!session) return false;
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
        this.adapter.setStatusMessage(`Stopped targeted placement for ${targetTitle}.`);
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
