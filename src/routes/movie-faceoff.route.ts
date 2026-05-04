import { css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation, WebComponentInterface } from '@vaadin/router';
import { base } from '../baseStyles';
import { movieFaceoffShared } from '../movieFaceoffStyles';
import {
    MovieFaceoffMovie,
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';
import {
    FaceoffMovie,
    fetchMovieFaceoffIds,
    fetchTmdbMovie,
    getMoviePosterUrl,
} from '../services/movie-faceoff.service';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import {
    getCandidatePool,
    pickInformativeOpponent,
    pickInformativePair,
} from '../utils/movie-faceoff-pairing';
import { MOVIE_FACEOFF_RANKING_ALGORITHMS } from '../utils/movie-faceoff-rankings';
import {
    DEFAULT_MODE_ID,
    getMode,
    ModeDef,
    Pool,
    PoolContext,
} from '../utils/movie-faceoff-pools';
import {
    clonePair,
    FaceoffPair,
    MovieStateChange,
    TargetedInsertionState,
    UndoAction,
} from '../utils/movie-faceoff-types';
import { createMovieFaceoffKeyboardHandler } from '../utils/movie-faceoff-keyboard';
import { MovieFaceoffTargetedInsertionController } from '../utils/movie-faceoff-targeted-insertion-controller';
import { MovieFaceoffUndoManager } from '../utils/movie-faceoff-undo';
import {
    parseMovieFaceoffUrl,
    updateMovieFaceoffQueryParams,
} from '../utils/movie-faceoff-url-sync';
import '../components/jot-icon';
import '../components/movie-faceoff/movie-faceoff-matchup.component';
import '../components/movie-faceoff/movie-faceoff-pool-toggle.component';
import '../components/movie-faceoff/movie-faceoff-rankings.component';
import '../components/movie-faceoff/movie-faceoff-status-bar.component';
import '../components/utility-page-header.component';
import { betterGo } from './route-config';

// Yield to the browser before kicking off heavy synchronous work
// (`pickInformativePair` builds an N×N matrix across all primary ranking
// algorithms). Without a real task break, Lit's pending render and the
// browser's next paint can both end up queued behind the matrix build.
function yieldToBrowser(): Promise<void> {
    return new Promise((resolve) => {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(() => resolve(), { timeout: 100 });
        } else {
            setTimeout(resolve, 0);
        }
    });
}

@customElement('movie-faceoff-route')
export class MovieFaceoffRoute
    extends MobxLitElement
    implements WebComponentInterface
{
    @state()
    private movies: FaceoffPair = [null, null];

    @state()
    private modeId: string = DEFAULT_MODE_ID;

    @state()
    private isLoading = false;

    @state()
    private errorMessage = '';

    @state()
    private statusMessage = '';

    @state()
    private targetedInsertion: TargetedInsertionState | null = null;

    @state()
    private showUndo = false;

    @state()
    private sortMode: MovieFaceoffSortMode = 'elo';

    private undoManager = new MovieFaceoffUndoManager();
    private movieIdPool: number[] | null = null;
    private movieIdPoolPromise?: Promise<number[]>;
    private pendingTargetMovieId?: number;
    private pendingPairIds?: [number, number];
    private routeInitialized = false;
    private preloadedPair: [FaceoffMovie, FaceoffMovie] | null = null;
    private preloadInFlight = false;
    private readonly targetedInsertionController =
        new MovieFaceoffTargetedInsertionController({
            getSession: () => this.targetedInsertion,
            setSession: (next) => {
                this.targetedInsertion = next;
            },
            setPendingTargetMovieId: (id) => {
                this.pendingTargetMovieId = id;
            },
            getRankedSnapshotForSort: (sortMode) =>
                movieFaceoff
                    .getRankedMovies(sortMode)
                    .filter((movie) => !movie.excludedAt && !movie.unseenAt),
            hasPriorVotes: (movieId) => {
                const rating = movieFaceoff.replayState.ratings.get(movieId);
                if (!rating) return false;
                return (rating.winCount || 0) + (rating.lossCount || 0) > 0;
            },
            setModeIdSilent: (modeId) => this.setModeIdSilent(modeId),
            setStatusMessage: (message) => {
                this.statusMessage = message;
            },
            setErrorMessage: (message) => {
                this.errorMessage = message;
            },
            setMovies: (movies) => {
                this.movies = movies;
            },
            syncPairToUrl: () => this.syncPairToUrl(),
            displayNewPair: () => this.displayNewPair(),
            upsertMoviesMetadata: (movies) =>
                movieFaceoff.upsertMoviesMetadata(movies),
            fetchMovie: (id) => fetchTmdbMovie(id),
        });
    private readonly keyDownHandler = createMovieFaceoffKeyboardHandler({
        hasTargetedInsertion: () => Boolean(this.targetedInsertion),
        hasMoviePair: () => Boolean(this.movies[0] && this.movies[1]),
        cancelTargetedInsertion: () => this.cancelTargetedInsertion(),
        markMovieUnseen: (index) => void this.markMovieUnseen(index),
        markBothMoviesUnseen: () => void this.markBothMoviesUnseen(),
        vote: (index) => void this.vote(index),
    });

    async onAfterEnter(location: RouterLocation) {
        const urlState = parseMovieFaceoffUrl(location.search);

        this.pendingTargetMovieId = urlState.targetMovieId;
        if (urlState.sortMode) this.sortMode = urlState.sortMode;
        if (urlState.pairIds) this.pendingPairIds = urlState.pairIds;
        this.modeId = urlState.modeId;

        if (!this.routeInitialized) return;

        await this.maybeStartTargetedInsertionFromUrl();
    }

    connectedCallback() {
        super.connectedCallback();
        this.undoManager.restore();
        if (this.undoManager.hasEntries) {
            this.showUndo = true;
        }
        void this.initializeRoute();
        window.addEventListener('keydown', this.keyDownHandler);
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this.keyDownHandler);
        super.disconnectedCallback();
    }

    private async initializeRoute() {
        this.ensureMovieIdPool().catch(() => {});
        await movieFaceoff.ensureLoaded();
        this.routeInitialized = true;

        const startedFromUrl = await this.maybeStartTargetedInsertionFromUrl();
        if (startedFromUrl) return;

        if (this.pendingPairIds) {
            const [leftId, rightId] = this.pendingPairIds;
            this.pendingPairIds = undefined;
            try {
                const [left, right] = await Promise.all([
                    this.loadMovie(leftId),
                    this.loadMovie(rightId),
                ]);
                this.movies = [left, right];
                void this.kickoffPreload();
                return;
            } catch {
                // fall through to displayNewPair
            }
        }

        await this.displayNewPair();
    }

    private get replayState() {
        return movieFaceoff.replayState;
    }

    private get mode(): ModeDef {
        return getMode(this.modeId);
    }

    private get visibleRankedMovies() {
        return movieFaceoff.getRankedMovies(this.sortMode).filter(
            (movie) => !movie.excludedAt && !movie.unseenAt
        );
    }

    private buildPoolContext(): PoolContext | null {
        if (!this.movieIdPool) return null;
        const decisiveIds = this.replayState.decisiveMovieIds;
        const excludedIds = movieFaceoff.excludedMovieIds;
        const unseenIds = movieFaceoff.unseenMovieIds;
        const respondedIds = new Set<number>(decisiveIds);
        excludedIds.forEach((id) => respondedIds.add(id));
        unseenIds.forEach((id) => respondedIds.add(id));
        return {
            fullTmdbIds: this.movieIdPool,
            decisiveIds,
            respondedIds,
        };
    }

    private poolForSide(side: 0 | 1): Pool {
        const { pairing } = this.mode;
        if (pairing.kind === 'cross') return side === 0 ? pairing.left : pairing.right;
        return pairing.pool;
    }

    private get availableMovieCount(): number | null {
        const ctx = this.buildPoolContext();
        if (!ctx) return null;
        // For cross modes, the left pool is the placement bottleneck
        // (e.g. "X new movies to place"); single modes report their own pool.
        const pool =
            this.mode.pairing.kind === 'cross'
                ? this.mode.pairing.left
                : this.mode.pairing.pool;
        return getCandidatePool(
            pool(ctx),
            movieFaceoff.excludedMovieIds,
            movieFaceoff.unseenMovieIds
        ).length;
    }

    private get sessionStatusTone() {
        if (this.errorMessage) return 'error';
        if (this.isLoading) return 'loading';
        if (this.targetedInsertion) return 'active';
        if (this.showUndo) return 'active';
        return 'idle';
    }

    private get sessionStatusLabel() {
        if (this.errorMessage) return 'Needs attention';
        if (this.targetedInsertion?.phase === 'pivot') {
            return 'Placing your chosen movie';
        }
        if (this.targetedInsertion?.phase === 'pinned') {
            return 'Pinned · pairing freely';
        }
        if (this.isLoading) return 'Loading next matchup';
        return 'Ready for the next pick';
    }

    private setModeIdSilent(modeId: string) {
        if (this.modeId === modeId) return;
        this.modeId = modeId;
        this.invalidatePreload();
        // Mode change voids undo — the prior pair was drawn from a different
        // pool, so restoring it would land the user in an inconsistent state.
        this.undoManager.clear();
        this.showUndo = false;
        updateMovieFaceoffQueryParams({
            pool: modeId === DEFAULT_MODE_ID ? undefined : modeId,
        });
    }

    private async setMode(modeId: string) {
        if (this.modeId === modeId) return;
        // Targeted mode is anchored to ranked. Leaving ranked is an implicit
        // "unpin"; cancel before switching so the controller's own teardown
        // (status message, URL clear) runs.
        if (modeId !== 'ranked' && this.targetedInsertion) {
            this.setModeIdSilent(modeId);
            this.targetedInsertionController.cancel();
            return;
        }
        this.setModeIdSilent(modeId);
        await this.displayNewPair();
    }

    private snapshotMovieChanges(movieIds: number[]): MovieStateChange[] {
        return [...new Set(movieIds)].map((movieId) => {
            const movie = movieFaceoff.movieMap.get(movieId);
            return {
                movieId,
                previousExcludedAt: movie?.excludedAt,
                previousUnseenAt: movie?.unseenAt,
            };
        });
    }

    private async performAction(
        action: UndoAction,
        movieIds: number[] | undefined,
        perform: () => Promise<number | void>,
        statusMessage: string,
    ) {
        const previousPair = clonePair(this.movies);
        const previousTargetedInsertion = this.targetedInsertion
            ? { ...this.targetedInsertion }
            : null;
        const movieChanges = movieIds ? this.snapshotMovieChanges(movieIds) : undefined;
        const result = await perform();
        this.undoManager.push({
            action,
            eventId: typeof result === 'number' ? result : undefined,
            movieChanges,
            pair: previousPair,
            targetedInsertion: previousTargetedInsertion,
        });
        this.statusMessage = statusMessage;
        this.showUndo = true;
    }

    private async undoLastAction() {
        const entry = this.undoManager.pop();
        if (!entry) return;

        this.invalidatePreload();

        if (entry.eventId !== undefined) {
            await movieFaceoff.deleteEvent(entry.eventId);
        }

        for (const change of entry.movieChanges || []) {
            await movieFaceoff.setMovieExcludedAt(
                change.movieId,
                change.previousExcludedAt
            );
            await movieFaceoff.setMovieUnseenAt(
                change.movieId,
                change.previousUnseenAt
            );
        }

        this.movies = clonePair(entry.pair);
        this.targetedInsertion = entry.targetedInsertion ?? null;
        this.syncPairToUrl();
        this.errorMessage = '';
        this.showUndo = this.undoManager.hasEntries;
        this.statusMessage = 'Undid last action';
    }

    private ensureMovieIdPool(): Promise<number[]> {
        if (this.movieIdPool) return Promise.resolve(this.movieIdPool);
        if (!this.movieIdPoolPromise) {
            this.movieIdPoolPromise = fetchMovieFaceoffIds().then(
                (ids) => {
                    this.movieIdPool = ids;
                    return ids;
                },
                (error) => {
                    this.movieIdPoolPromise = undefined;
                    throw error;
                }
            );
        }
        return this.movieIdPoolPromise;
    }

    private async resolvePoolIds(pool: Pool, exclude: number[] = []): Promise<number[]> {
        await this.ensureMovieIdPool();
        const ctx = this.buildPoolContext();
        if (!ctx) return [];
        return getCandidatePool(
            pool(ctx),
            movieFaceoff.excludedMovieIds,
            movieFaceoff.unseenMovieIds,
            exclude
        );
    }

    private readonly loadMovie = async (id: number): Promise<FaceoffMovie> => {
        const movie = await fetchTmdbMovie(id);
        await movieFaceoff.upsertMoviesMetadata([movie]);
        return movie;
    };

    private maybeStartTargetedInsertionFromUrl() {
        this.invalidatePreload();
        return this.targetedInsertionController.maybeStartFromUrl(
            this.pendingTargetMovieId
        );
    }

    private cancelTargetedInsertion() {
        this.targetedInsertionController.cancel();
    }

    private async displayNewPair() {
        const session = this.targetedInsertion;
        if (session && session.phase === 'pivot') return;

        if (session && session.phase === 'pinned') {
            await this.displayPinnedPair(session.targetMovie);
            return;
        }

        const cached = this.takePreloadedPair();
        if (cached) {
            this.movies = cached;
            this.errorMessage = '';
            this.isLoading = false;
            this.syncPairToUrl();
            void this.kickoffPreload();
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';
        try {
            const mode = this.mode;

            // Build both pools up front. For cross modes this avoids a wasted
            // TMDB load when the right pool is empty.
            const leftPool =
                mode.pairing.kind === 'cross'
                    ? await this.resolvePoolIds(mode.pairing.left)
                    : await this.resolvePoolIds(mode.pairing.pool);

            if (!leftPool.length) {
                this.movies = [null, null];
                this.errorMessage = mode.emptyMessage(
                    mode.pairing.kind === 'cross' ? 'left' : 'single'
                );
                return;
            }

            const rightPool =
                mode.pairing.kind === 'cross'
                    ? await this.resolvePoolIds(mode.pairing.right)
                    : leftPool;

            if (!rightPool.length) {
                this.movies = [null, null];
                this.errorMessage = mode.emptyMessage(
                    mode.pairing.kind === 'cross' ? 'right' : 'single'
                );
                return;
            }

            await yieldToBrowser();
            const pair = pickInformativePair(
                leftPool,
                rightPool,
                this.replayState,
                MOVIE_FACEOFF_RANKING_ALGORITHMS
            );
            if (pair === null) {
                this.movies = [null, null];
                this.errorMessage = mode.emptyMessage(
                    mode.pairing.kind === 'cross' ? 'right' : 'single'
                );
                return;
            }

            const [leftId, rightId] = pair;
            const [left, right] = await Promise.all([
                this.loadMovie(leftId),
                this.loadMovie(rightId),
            ]);
            this.movies = [left, right];
            this.syncPairToUrl();
            void this.kickoffPreload();
        } catch (error) {
            this.movies = [null, null];
            this.errorMessage =
                error instanceof Error ? error.message : 'Unable to load movies.';
        } finally {
            this.isLoading = false;
        }
    }

    private async displayPinnedPair(target: FaceoffMovie) {
        const cached = this.takePinnedPreload(target.id);
        if (cached) {
            this.movies = cached;
            this.errorMessage = '';
            this.isLoading = false;
            this.syncPairToUrl();
            void this.kickoffPreload();
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';
        try {
            // Pinned mode draws opponents from the right side of the active
            // mode (or the single pool). Targeted insertion forces 'ranked',
            // so this is normally the ranked pool.
            const opponentPool = await this.resolvePoolIds(
                this.poolForSide(1),
                [target.id]
            );
            await yieldToBrowser();
            const opponentId = pickInformativeOpponent(
                opponentPool,
                this.replayState,
                MOVIE_FACEOFF_RANKING_ALGORITHMS,
                target.id
            );
            if (opponentId === null) {
                this.movies = [target, null];
                this.errorMessage = this.mode.emptyMessage(
                    this.mode.pairing.kind === 'cross' ? 'right' : 'single'
                );
                return;
            }
            const opponent = await this.loadMovie(opponentId);
            this.movies = [target, opponent];
            this.syncPairToUrl();
            void this.kickoffPreload();
        } catch (error) {
            this.movies = [target, null];
            this.errorMessage =
                error instanceof Error ? error.message : 'Unable to load opponent.';
        } finally {
            this.isLoading = false;
        }
    }

    private takePinnedPreload(targetId: number): [FaceoffMovie, FaceoffMovie] | null {
        const pair = this.preloadedPair;
        if (!pair) return null;
        if (pair[0].id !== targetId) return null;
        if (!this.isPreloadMovieValid(pair[1], 1)) return null;
        this.preloadedPair = null;
        return pair;
    }

    private isPreloadMovieValid(movie: FaceoffMovie, side: 0 | 1): boolean {
        const excluded = movieFaceoff.excludedMovieIds;
        const unseen = movieFaceoff.unseenMovieIds;
        if (excluded.has(movie.id) || unseen.has(movie.id)) return false;
        const ctx = this.buildPoolContext();
        if (!ctx) return true; // pool not yet loaded; defer to consumer
        const ids = this.poolForSide(side)(ctx);
        return ids.includes(movie.id);
    }

    private takePreloadedPair(): [FaceoffMovie, FaceoffMovie] | null {
        const pair = this.preloadedPair;
        if (!pair) return null;
        this.preloadedPair = null;
        if (
            !this.isPreloadMovieValid(pair[0], 0) ||
            !this.isPreloadMovieValid(pair[1], 1)
        ) {
            return null;
        }
        return pair;
    }

    private invalidatePreload() {
        this.preloadedPair = null;
    }

    private async kickoffPreload() {
        const session = this.targetedInsertion;
        if (session && session.phase === 'pivot') return;
        if (this.preloadedPair || this.preloadInFlight) return;
        // In cross modes, every vote moves the left movie out of the
        // unresponded pool, so a preloaded pair is stale by construction.
        // Skip the cache entirely; the next pair always rebuilds fresh.
        if (this.mode.pairing.kind === 'cross') return;
        this.preloadInFlight = true;
        try {
            if (session && session.phase === 'pinned') {
                const target = session.targetMovie;
                const opponentPool = await this.resolvePoolIds(this.poolForSide(1), [
                    target.id,
                    ...this.movies
                        .filter((m): m is FaceoffMovie => Boolean(m))
                        .map((m) => m.id),
                ]);
                await yieldToBrowser();
                const opponentId = pickInformativeOpponent(
                    opponentPool,
                    this.replayState,
                    MOVIE_FACEOFF_RANKING_ALGORITHMS,
                    target.id
                );
                if (opponentId === null) return;
                const opponent = await this.loadMovie(opponentId);
                await Promise.all([
                    this.preloadImage(getMoviePosterUrl(target)),
                    this.preloadImage(getMoviePosterUrl(opponent)),
                ]);
                if (this.targetedInsertion?.phase !== 'pinned') return;
                if (this.targetedInsertion.targetMovie.id !== target.id) return;
                this.preloadedPair = [target, opponent];
                return;
            }

            const currentIds = this.movies
                .filter((m): m is FaceoffMovie => Boolean(m))
                .map((m) => m.id);
            // Single-mode preload — left and right come from the same pool.
            if (this.mode.pairing.kind !== 'single') return;
            const pool = await this.resolvePoolIds(this.mode.pairing.pool, currentIds);

            await yieldToBrowser();
            const pair = pickInformativePair(
                pool,
                pool,
                this.replayState,
                MOVIE_FACEOFF_RANKING_ALGORITHMS
            );
            if (pair === null) return;
            const [leftId, rightId] = pair;

            const [left, right] = await Promise.all([
                this.loadMovie(leftId),
                this.loadMovie(rightId),
            ]);
            await Promise.all([
                this.preloadImage(getMoviePosterUrl(left)),
                this.preloadImage(getMoviePosterUrl(right)),
            ]);
            if (this.targetedInsertion) return;
            this.preloadedPair = [left, right];
        } catch {
            // Swallow — fall through to regular fetch on next displayNewPair.
        } finally {
            this.preloadInFlight = false;
        }
    }

    private preloadImage(url: string): Promise<void> {
        if (!url) return Promise.resolve();
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = url;
        });
    }

    private syncPairToUrl() {
        const [left, right] = this.movies;
        updateMovieFaceoffQueryParams({
            left: left?.id,
            right: right?.id,
        });
    }

    private async replaceUnavailableMovie(index: 0 | 1) {
        const session = this.targetedInsertion;
        if (session && session.phase === 'pivot') {
            this.errorMessage = 'Targeted placement only supports choosing between the target and comparison movie.';
            return;
        }
        if (session && session.phase === 'pinned') {
            // The target lives in slot 0; replacing it ends the pin.
            // Replacing slot 1 just picks a fresh opponent.
            if (index === 0) {
                this.targetedInsertionController.clearSilent();
                await this.displayNewPair();
                return;
            }
            await this.displayPinnedPair(session.targetMovie);
            return;
        }

        const existingMovies = this.movies.filter(Boolean) as FaceoffMovie[];
        const exclude = existingMovies.map((movie) => movie.id);
        const otherMovie = existingMovies.find(movie => movie.id !== this.movies[index]?.id);

        if (!otherMovie) {
            await this.displayNewPair();
            return;
        }

        const pool = await this.resolvePoolIds(this.poolForSide(index), exclude);
        await yieldToBrowser();
        const replacementId = pickInformativeOpponent(
            pool,
            this.replayState,
            MOVIE_FACEOFF_RANKING_ALGORITHMS,
            otherMovie.id
        );
        if (replacementId === null) {
            await this.displayNewPair();
            return;
        }
        let replacement: FaceoffMovie;
        try {
            replacement = await this.loadMovie(replacementId);
        } catch {
            await this.displayNewPair();
            return;
        }

        this.movies =
            index === 0
                ? [replacement, this.movies[1]]
                : [this.movies[0], replacement];
        this.syncPairToUrl();
        void this.kickoffPreload();
    }

    private async vote(winnerIndex: 0 | 1) {
        const [left, right] = this.movies;
        if (!left || !right) return;

        const winner = winnerIndex === 0 ? left : right;
        const loser = winnerIndex === 0 ? right : left;
        const targetId = this.targetedInsertion?.targetMovie.id;
        await this.performAction('vote', undefined,
            () => movieFaceoff.recordVote(winner, loser, targetId), 'Recorded vote');

        const advanced = await this.targetedInsertionController.advanceAfterVote(
            winnerIndex === 0
        );
        if (advanced) return;
        await this.displayNewPair();
    }

    private async markMovieUnseen(index: 0 | 1) {
        const [left, right] = this.movies;
        if (!left || !right) return;

        const movie = index === 0 ? left : right;
        const rating = this.replayState.ratings.get(movie.id);
        const totalVotes = (rating?.winCount ?? 0) + (rating?.lossCount ?? 0);
        if (totalVotes > 0 && !confirm(
            `"${movie.title}" has ${totalVotes} vote${totalVotes === 1 ? '' : 's'}. Mark as not seen? (You can undo this.)`
        )) return;

        await this.performAction(index === 0 ? 'not-seen-left' : 'not-seen-right',
            [movie.id], () => movieFaceoff.markMovieUnseen(movie.id), 'Marked as not seen');

        if (this.targetedInsertion) {
            if (this.targetedInsertionController.clearForTargetRemoved(movie.id)) {
                this.statusMessage = `Marked ${movie.title} as not seen and unpinned`;
                await this.displayNewPair();
                return;
            }
            await this.targetedInsertionController.refresh({ preserveCurrentPair: false });
            return;
        }
        await this.replaceUnavailableMovie(index);
    }

    private async markBothMoviesUnseen() {
        const [left, right] = this.movies;
        if (!left || !right) return;

        const leftRating = this.replayState.ratings.get(left.id);
        const rightRating = this.replayState.ratings.get(right.id);
        const totalVotes = (leftRating?.winCount ?? 0) + (leftRating?.lossCount ?? 0)
            + (rightRating?.winCount ?? 0) + (rightRating?.lossCount ?? 0);
        if (totalVotes > 0 && !confirm(
            `This will mark both movies as not seen (${totalVotes} total vote${totalVotes === 1 ? '' : 's'}). Continue? (You can undo this.)`
        )) return;

        await this.performAction('not-seen-both', [left.id, right.id],
            () => movieFaceoff.markMoviesUnseen([left.id, right.id]),
            'Marked both movies as not seen');

        this.targetedInsertionController.clearSilent();
        await this.displayNewPair();
    }

    private async excludeMovie(movie: MovieFaceoffRankedMovie) {
        await this.performAction('exclude', [movie.id],
            () => movieFaceoff.excludeMovie(movie.id), `Excluded ${movie.title}`);

        this.invalidatePreload();
        const wasPinnedTarget =
            this.targetedInsertionController.clearForTargetRemoved(movie.id);
        if (wasPinnedTarget || this.movies.some((m) => m?.id === movie.id)) {
            await this.displayNewPair();
        }
    }

    private async restoreExcludedMovie(movie: MovieFaceoffMovie) {
        await this.performAction('restore-excluded', [movie.id],
            () => movieFaceoff.restoreMovie(movie.id), `Restored ${movie.title}`);
    }

    render() {
        const statusTone = this.sessionStatusTone;
        const statusLabel = this.statusMessage || this.sessionStatusLabel;

        return html`
            <utility-page-header title="Movie Faceoff">
                <button
                    slot="actions"
                    class="outline header-action-button"
                    @click=${() => {
                        betterGo('movie-faceoff-browse');
                    }}
                >
                    <jot-icon name="List"></jot-icon>
                    <span>Browse</span>
                </button>
                <button
                    slot="actions"
                    class="outline header-action-button"
                    @click=${() => {
                        betterGo('movie-faceoff-add');
                    }}
                >
                    <jot-icon name="Search"></jot-icon>
                    <span>Find movie</span>
                </button>
            </utility-page-header>
            <main class="layout">
                <section class="faceoff-column">
                    <article class="faceoff-panel surface-panel">
                        <header class="panel-header">
                            <hgroup>
                                <p class="eyebrow">Which would you rather watch?</p>
                                <h2>Current faceoff</h2>
                            </hgroup>
                            <movie-faceoff-pool-toggle
                                .modeId=${this.modeId}
                                @pool-change=${(e: CustomEvent) => {
                                    void this.setMode(e.detail.modeId);
                                }}
                            ></movie-faceoff-pool-toggle>
                        </header>

                        <movie-faceoff-matchup
                            .movies=${this.movies}
                            .loading=${this.isLoading}
                            .errorMessage=${this.errorMessage}
                            .targetedInsertion=${this.targetedInsertion}
                            @faceoff-vote=${(e: CustomEvent) => void this.vote(e.detail.index)}
                            @faceoff-unseen=${(e: CustomEvent) => void this.markMovieUnseen(e.detail.index)}
                            @faceoff-unpin=${() => this.cancelTargetedInsertion()}
                            @faceoff-details=${(e: CustomEvent) => {
                                const movie = this.movies[e.detail.index as 0 | 1];
                                if (movie) betterGo('movie-faceoff-movie', { pathParams: { id: movie.id } });
                            }}
                        ></movie-faceoff-matchup>

                        <footer class="session-panel">
                            <div style="justify-self:start" role="group" aria-label="Current matchup actions">
                                <button
                                    class="outline danger"
                                    @click=${() => {
                                        void this.markBothMoviesUnseen();
                                    }}
                                >
                                    <jot-icon name="EyeOff"></jot-icon>
                                    Mark both unseen
                                </button>
                            </div>
                            <movie-faceoff-status-bar
                                .statusTone=${statusTone}
                                .statusLabel=${statusLabel}
                                .showUndo=${this.showUndo}
                                .rankedCount=${this.visibleRankedMovies.length}
                                .votesCount=${movieFaceoff.allEvents.length}
                                .availableCount=${this.availableMovieCount}
                                .availableLabel=${this.mode.availableLabel ?? 'Available'}
                                @undo-action=${() => void this.undoLastAction()}
                            ></movie-faceoff-status-bar>
                        </footer>
                    </article>
                </section>

                <aside class="rankings-column">
                    <movie-faceoff-rankings
                        .sortMode=${this.sortMode}
                        @sort-change=${(e: CustomEvent) => {
                            this.sortMode = e.detail.sortMode;
                            updateMovieFaceoffQueryParams({
                                sort: this.sortMode === 'elo' ? undefined : this.sortMode,
                            });
                        }}
                        @exclude-movie=${(e: CustomEvent) => {
                            void this.excludeMovie(e.detail.movie);
                        }}
                        @restore-excluded=${(e: CustomEvent) => {
                            void this.restoreExcludedMovie(e.detail.movie);
                        }}
                        @navigate-movie=${(e: CustomEvent) => {
                            betterGo('movie-faceoff-movie', {
                                pathParams: { id: e.detail.movieId },
                            });
                        }}
                        @rank-movie=${(e: CustomEvent) => {
                            betterGo('movie-faceoff', {
                                queryParams: { targetMovieId: e.detail.movieId },
                            });
                        }}
                    ></movie-faceoff-rankings>
                </aside>
            </main>
        `;
    }

    static styles = [
        base,
        movieFaceoffShared,
        css`
            :host {
                display: flex;
                flex-direction: column;
                gap: var(--pico-spacing);
                width: min(100%, 90rem);
                margin-inline: auto;
            }
            .layout {
                display: grid;
                gap: 1rem;
                grid-template-columns: minmax(0, 1fr);
                align-items: start;
            }
            .faceoff-column,
            .rankings-column,
            .surface-panel {
                min-width: 0;
            }
            .surface-panel {
                position: relative;
                overflow: hidden;
                margin: 0;
            }
            .header-action-button {
                margin: 0;
                padding-inline: 0.7rem;
                min-height: 2.25rem;
            }
            .header-action-button span {
                display: inline-block;
            }
            .panel-header {
                position: relative;
                z-index: 1;
                display: flex;
                justify-content: space-between;
                align-items: start;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .session-panel {
                display: grid;
                gap: 1rem;
                background: transparent;
                border: 0;
            }
            @media (min-width: 1320px) {
                .layout {
                    grid-template-columns: minmax(0, 1fr) 26rem;
                }
            }
            @media (max-width: 640px) {
                :host {
                    width: 100%;
                }
                .header-action-button span {
                    display: none;
                }
            }
        `,
    ];
}
