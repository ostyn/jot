import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation, WebComponentInterface } from '@vaadin/router';
import { base } from '../baseStyles';
import { movieFaceoffShared } from '../movieFaceoffStyles';
import {
    MOVIE_FACEOFF_SORT_MODES,
    MovieFaceoffMovie,
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';
import {
    FaceoffMovie,
    fetchMovieFaceoffIds,
    fetchTmdbMovie,
} from '../services/movie-faceoff.service';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import {
    getMovieFaceoffRankingAlgorithm,
    getMovieFaceoffRankedMovies,
} from '../utils/movie-faceoff-rankings';
import {
    getCandidatePool,
    getRandomMovie,
    getSmartMovie,
} from '../utils/movie-faceoff-pairing';
import {
    advanceTargetedInsertion,
    createTargetedInsertionState,
} from '../utils/movie-faceoff-targeted-insertion';
import {
    clonePair,
    FaceoffPair,
    MovieStateChange,
    TargetedInsertionState,
    UndoAction,
} from '../utils/movie-faceoff-types';
import { MovieFaceoffUndoManager } from '../utils/movie-faceoff-undo';
import '../components/jot-icon';
import '../components/movie-faceoff-card.component';
import '../components/movie-faceoff-rankings.component';
import '../components/utility-page-header.component';
import { betterGo } from './route-config';

@customElement('movie-faceoff-route')
export class MovieFaceoffRoute
    extends MobxLitElement
    implements WebComponentInterface
{
    @state()
    private movies: FaceoffPair = [null, null];

    @state()
    private useRankedOnly = false;

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
    private pendingTargetMovieId?: number;
    private pendingPairIds?: [number, number];
    private routeInitialized = false;
    private readonly keyDownHandler = (event: KeyboardEvent) =>
        this.handleKeyDown(event);

    async onAfterEnter(location: RouterLocation) {
        const search = new URLSearchParams(location.search);

        const targetMovieId = Number(search.get('targetMovieId'));
        this.pendingTargetMovieId =
            Number.isFinite(targetMovieId) && targetMovieId > 0
                ? targetMovieId
                : undefined;

        const sortParam = search.get('sort');
        if (sortParam && (MOVIE_FACEOFF_SORT_MODES as readonly string[]).includes(sortParam)) {
            this.sortMode = sortParam as MovieFaceoffSortMode;
        }

        const leftId = Number(search.get('left'));
        const rightId = Number(search.get('right'));
        if (Number.isFinite(leftId) && leftId > 0 && Number.isFinite(rightId) && rightId > 0) {
            this.pendingPairIds = [leftId, rightId];
        }

        this.useRankedOnly = search.get('pool') === 'mine';

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

    private updateQueryParams(params: Record<string, string | number | undefined>) {
        const url = new URL(window.location.href);
        for (const [key, value] of Object.entries(params)) {
            if (value === undefined) url.searchParams.delete(key);
            else url.searchParams.set(key, String(value));
        }
        history.replaceState(null, '', url);
    }

    private async initializeRoute() {
        await movieFaceoff.refresh();
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
                return;
            } catch {
                // Fall through to displayNewPair if restoration fails
            }
        }

        await this.displayNewPair();
    }

    private get replayState() {
        return movieFaceoff.replayState;
    }

    private get visibleRankedMovies() {
        return getMovieFaceoffRankedMovies(this.replayState, this.sortMode).filter(
            (movie) => !movie.excludedAt && !movie.unseenAt
        );
    }

    private get availableMovieCount() {
        const excludedIds = movieFaceoff.excludedMovieIds;
        const unseenIds = movieFaceoff.unseenMovieIds;

        if (this.useRankedOnly) {
            return Array.from(this.replayState.decisiveMovieIds).filter(
                (id) => !excludedIds.has(id) && !unseenIds.has(id)
            ).length;
        }

        if (!this.movieIdPool) return null;

        return this.movieIdPool.filter(
            (id) => !excludedIds.has(id) && !unseenIds.has(id)
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
        if (this.targetedInsertion) return 'Placing your chosen movie';
        if (this.isLoading) return 'Loading next matchup';
        return 'Ready for the next pick';
    }

    private get isTargetedMode() {
        return Boolean(this.targetedInsertion);
    }

    private get targetedProgressLabel() {
        const session = this.targetedInsertion;
        if (!session) return '';
        const remainingWindow = Math.max(session.high - session.low, 0);
        if (session.complete) return 'Placement locked';
        if (!session.rankedSnapshot.length) return 'Need more ranked movies';
        return `${session.comparisonsCompleted} comparison${
            session.comparisonsCompleted === 1 ? '' : 's'
        } made, ${remainingWindow + 1} possible slot${
            remainingWindow === 0 ? '' : 's'
        } left`;
    }

    private async setPoolMode(useRankedOnly: boolean) {
        if (this.useRankedOnly === useRankedOnly) return;
        this.useRankedOnly = useRankedOnly;
        this.updateQueryParams({ pool: useRankedOnly ? 'mine' : undefined });
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

    private async ensureMovieIdPool() {
        if (this.movieIdPool) return this.movieIdPool;
        this.movieIdPool = await fetchMovieFaceoffIds();
        return this.movieIdPool;
    }

    private async buildCandidatePool(exclude: number[] = []) {
        const allIds = this.useRankedOnly
            ? Array.from(this.replayState.decisiveMovieIds)
            : await this.ensureMovieIdPool();
        return getCandidatePool(
            allIds,
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

    private async pickSmartMovie(exclude: number[] = [], firstMovie?: FaceoffMovie): Promise<FaceoffMovie | null> {
        const pool = await this.buildCandidatePool(exclude);
        return getSmartMovie(pool, this.replayState.ratings, this.loadMovie, firstMovie);
    }

    private async pickRandomMovie(exclude: number[] = []): Promise<FaceoffMovie | null> {
        const pool = await this.buildCandidatePool(exclude);
        return getRandomMovie(pool, this.loadMovie);
    }

    private buildTargetedInsertionState(
        targetMovie: FaceoffMovie,
        comparisonsCompleted = 0,
        low = 0,
        high?: number
    ): TargetedInsertionState {
        return createTargetedInsertionState(
            targetMovie,
            this.visibleRankedMovies,
            this.sortMode,
            comparisonsCompleted,
            low,
            high
        );
    }

    private async refreshTargetedInsertion(
        options: {
            comparisonsCompleted?: number;
            low?: number;
            high?: number;
            preserveCurrentPair?: boolean;
        } = {}
    ) {
        const session = this.targetedInsertion;
        if (!session) return;

        const nextState = this.buildTargetedInsertionState(
            session.targetMovie,
            options.comparisonsCompleted ?? session.comparisonsCompleted,
            options.low ?? session.low,
            options.high ?? session.high
        );

        this.targetedInsertion = nextState;

        if (nextState.complete) {
            const estimatedPlacement = Math.min(
                nextState.rankedSnapshot.length + 1,
                nextState.low + 1
            );
            this.targetedInsertion = null;
            this.pendingTargetMovieId = undefined;
            this.clearTargetedMovieQueryParam();
            this.statusMessage = nextState.rankedSnapshot.length
                ? `Placed ${nextState.targetMovie.title} at #${estimatedPlacement} in ${getMovieFaceoffRankingAlgorithm(this.sortMode).label}.`
                : 'Saved that movie. Rank a few movies first, then use targeted placement.';
            await this.displayNewPair();
            return;
        }

        if (!options.preserveCurrentPair) {
            this.movies = [nextState.targetMovie, nextState.pivotMovie];
            this.syncPairToUrl();
        }
    }

    private switchToManualSort() {
        if (this.sortMode !== 'manual') {
            this.sortMode = 'manual';
            this.updateQueryParams({ sort: 'manual' });
        }
    }

    private async startTargetedInsertion(movie: FaceoffMovie) {
        await movieFaceoff.upsertMoviesMetadata([movie]);

        this.switchToManualSort();
        const nextState = this.buildTargetedInsertionState(movie);
        this.targetedInsertion = nextState;

        if (nextState.complete) {
            const hasRankings = nextState.rankedSnapshot.length > 0;
            this.targetedInsertion = null;
            this.pendingTargetMovieId = undefined;
            this.clearTargetedMovieQueryParam();
            this.statusMessage = hasRankings
                ? `Placed ${movie.title} at #${nextState.low + 1} in ${getMovieFaceoffRankingAlgorithm(this.sortMode).label}.`
                : 'Saved that movie. Rank a few movies first, then use targeted placement.';
            await this.displayNewPair();
            this.errorMessage = hasRankings
                ? ''
                : 'Targeted placement needs at least one ranked movie to compare against.';
            return;
        }

        this.statusMessage = `Placing ${movie.title} using ${getMovieFaceoffRankingAlgorithm(this.sortMode).label}.`;
        this.errorMessage = '';
        this.movies = [movie, nextState.pivotMovie];
        this.syncPairToUrl();
    }

    private async maybeStartTargetedInsertionFromUrl() {
        if (!this.pendingTargetMovieId) return false;
        if (this.targetedInsertion?.targetMovie.id === this.pendingTargetMovieId) {
            return true;
        }

        try {
            const movie = await fetchTmdbMovie(this.pendingTargetMovieId);
            await this.startTargetedInsertion(movie);
            return true;
        } catch (error) {
            this.errorMessage =
                error instanceof Error
                    ? error.message
                    : 'Unable to start targeted placement.';
            return false;
        }
    }

    private clearTargetedMovieQueryParam() {
        this.updateQueryParams({ targetMovieId: undefined });
    }

    private cancelTargetedInsertion() {
        if (!this.targetedInsertion) return;
        const targetTitle = this.targetedInsertion.targetMovie.title;
        this.targetedInsertion = null;
        this.pendingTargetMovieId = undefined;
        this.clearTargetedMovieQueryParam();
        this.statusMessage = `Stopped targeted placement for ${targetTitle}.`;
        void this.displayNewPair();
    }

    private async displayNewPair() {
        if (this.targetedInsertion) return;
        this.isLoading = true;
        this.errorMessage = '';
        try {
            const useSmart = this.useRankedOnly;
            const left = await (useSmart ? this.pickSmartMovie() : this.pickRandomMovie());
            if (!left) {
                this.movies = [null, null];
                this.errorMessage = this.useRankedOnly
                    ? 'Rank at least two movies before using ranked-only mode.'
                    : 'No movies are available right now.';
                return;
            }

            const right = await (useSmart ? this.pickSmartMovie([left.id], left) : this.pickRandomMovie([left.id]));
            if (!right) {
                this.movies = [left, null];
                this.errorMessage = this.useRankedOnly
                    ? 'Rank at least two movies before using ranked-only mode.'
                    : 'Unable to find a second movie right now.';
                return;
            }

            this.movies = [left, right];
            this.syncPairToUrl();
        } catch (error) {
            this.movies = [null, null];
            this.errorMessage =
                error instanceof Error ? error.message : 'Unable to load movies.';
        } finally {
            this.isLoading = false;
        }
    }

    private syncPairToUrl() {
        const [left, right] = this.movies;
        this.updateQueryParams({
            left: left?.id,
            right: right?.id,
        });
    }

    private async replaceUnavailableMovie(index: 0 | 1) {
        if (this.targetedInsertion) {
            this.errorMessage = 'Targeted placement only supports choosing between the target and comparison movie.';
            return;
        }
        const existingMovies = this.movies.filter(Boolean) as FaceoffMovie[];
        const exclude = existingMovies.map((movie) => movie.id);
        const otherMovie = existingMovies.find(movie => movie.id !== this.movies[index]?.id);
        const useSmart = this.useRankedOnly;
        const replacement = await (useSmart ? this.pickSmartMovie(exclude, otherMovie) : this.pickRandomMovie(exclude));
        if (!replacement) {
            await this.displayNewPair();
            return;
        }

        this.movies =
            index === 0
                ? [replacement, this.movies[1]]
                : [this.movies[0], replacement];
        this.syncPairToUrl();
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (this.targetedInsertion && event.key === 'Escape') {
            event.preventDefault();
            this.cancelTargetedInsertion();
            return;
        }

        const [left, right] = this.movies;
        if (!left || !right) return;

        if (event.shiftKey && event.key === 'ArrowLeft') {
            event.preventDefault();
            void this.markMovieUnseen(0);
            return;
        }

        if (event.shiftKey && event.key === 'ArrowRight') {
            event.preventDefault();
            void this.markMovieUnseen(1);
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            void this.markBothMoviesUnseen();
            return;
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            void this.vote(0);
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            void this.vote(1);
        }
    }

    private async vote(winnerIndex: 0 | 1) {
        const [left, right] = this.movies;
        if (!left || !right) return;

        const winner = winnerIndex === 0 ? left : right;
        const loser = winnerIndex === 0 ? right : left;
        await this.performAction('vote', undefined,
            () => movieFaceoff.recordVote(winner, loser), 'Recorded vote');

        if (this.targetedInsertion) {
            const { low, high, comparisonsCompleted } = advanceTargetedInsertion(
                this.targetedInsertion, winnerIndex === 0);
            await this.refreshTargetedInsertion({ comparisonsCompleted, low, high });
            return;
        }
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
            if (this.targetedInsertion.targetMovie.id === movie.id) {
                this.targetedInsertion = null;
                this.pendingTargetMovieId = undefined;
                this.clearTargetedMovieQueryParam();
                this.statusMessage = `Marked ${movie.title} as not seen and stopped targeted placement`;
                await this.displayNewPair();
                return;
            }
            await this.refreshTargetedInsertion({ preserveCurrentPair: false });
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

        if (this.targetedInsertion) {
            this.targetedInsertion = null;
            this.pendingTargetMovieId = undefined;
            this.clearTargetedMovieQueryParam();
        }
        await this.displayNewPair();
    }

    private async excludeMovie(movie: MovieFaceoffRankedMovie) {
        await this.performAction('exclude', [movie.id],
            () => movieFaceoff.excludeMovie(movie.id), `Excluded ${movie.title}`);

        if (this.movies.some((m) => m?.id === movie.id)) {
            await this.displayNewPair();
        }
    }

    private async restoreExcludedMovie(movie: MovieFaceoffMovie) {
        await this.performAction('restore-excluded', [movie.id],
            () => movieFaceoff.restoreMovie(movie.id), `Restored ${movie.title}`);
    }

    private async restoreSeenMovie(movie: MovieFaceoffMovie) {
        await this.performAction('restore-seen', [movie.id],
            () => movieFaceoff.restoreMovieSeen(movie.id), `Marked ${movie.title} as seen again`);
    }

    private renderSummaryStat(label: string, value: string | number, accent = false) {
        return html`
            <article class="summary-stat ${accent ? 'accent' : ''}">
                <p>${label}</p>
                <strong>${value}</strong>
            </article>
        `;
    }

    private renderTargetedInsertionBanner() {
        const session = this.targetedInsertion;
        if (!session) return nothing;

        const estimatedPlacement = Math.min(
            session.rankedSnapshot.length + 1,
            session.low + 1
        );

        return html`
            <article class="targeted-banner">
                <div class="targeted-copy">
                    <hgroup>
                        <p class="eyebrow">Targeted placement</p>
                        <h3>${session.targetMovie.title}</h3>
                    </hgroup>
                    <p>
                        Compare it against key movies in ${getMovieFaceoffRankingAlgorithm(this.sortMode).label}.
                        Current estimated slot: #${estimatedPlacement}.
                    </p>
                </div>
                <div class="targeted-meta">
                    <strong>${this.targetedProgressLabel}</strong>
                    <button
                        class="secondary"
                        @click=${() => {
                            this.cancelTargetedInsertion();
                        }}
                    >
                        <jot-icon name="XCircle"></jot-icon>
                        Cancel
                    </button>
                </div>
            </article>
        `;
    }

    render() {
        const [left, right] = this.movies;
        const statusTone = this.sessionStatusTone;
        const statusLabel = this.statusMessage || this.sessionStatusLabel;

        return html`
            <utility-page-header title="Movie Faceoff">
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
                            <div role="group" class="pool-toggle" aria-label="Movie pool">
                                <button
                                    class=${this.useRankedOnly ? 'outline' : ''}
                                    aria-pressed=${!this.useRankedOnly}
                                    ?disabled=${this.isTargetedMode}
                                    @click=${() => {
                                        void this.setPoolMode(false);
                                    }}
                                >
                                    All movies
                                </button>
                                <button
                                    class=${this.useRankedOnly ? '' : 'outline'}
                                    aria-pressed=${this.useRankedOnly}
                                    ?disabled=${this.isTargetedMode}
                                    @click=${() => {
                                        void this.setPoolMode(true);
                                    }}
                                >
                                    My movies
                                </button>
                            </div>
                        </header>

                        ${this.renderTargetedInsertionBanner()}

                        ${this.errorMessage
                            ? html`<aside class="status-banner error" role="alert">
                                  <jot-icon name="AlertTriangle"></jot-icon>
                                  <span>${this.errorMessage}</span>
                              </aside>`
                            : nothing}

                        <section class="matchup-shell" aria-label="Current matchup">
                            <div class="matchup">
                                <movie-faceoff-card
                                    .movie=${left}
                                    .index=${0 as const}
                                    .loading=${this.isLoading}
                                    .errorMessage=${this.errorMessage}
                                    .targetedInsertion=${this.targetedInsertion}
                                    @faceoff-vote=${(e: CustomEvent) => void this.vote(e.detail.index)}
                                    @faceoff-unseen=${(e: CustomEvent) => void this.markMovieUnseen(e.detail.index)}
                                    @faceoff-details=${(e: CustomEvent) => {
                                        const movie = this.movies[e.detail.index as 0 | 1];
                                        if (movie) betterGo('movie-faceoff-movie', { pathParams: { id: movie.id } });
                                    }}
                                ></movie-faceoff-card>
                                <div class="matchup-divider" aria-hidden="true">
                                    <span>VS</span>
                                </div>
                                <movie-faceoff-card
                                    .movie=${right}
                                    .index=${1 as const}
                                    .loading=${this.isLoading}
                                    .errorMessage=${this.errorMessage}
                                    .targetedInsertion=${this.targetedInsertion}
                                    @faceoff-vote=${(e: CustomEvent) => void this.vote(e.detail.index)}
                                    @faceoff-unseen=${(e: CustomEvent) => void this.markMovieUnseen(e.detail.index)}
                                    @faceoff-details=${(e: CustomEvent) => {
                                        const movie = this.movies[e.detail.index as 0 | 1];
                                        if (movie) betterGo('movie-faceoff-movie', { pathParams: { id: movie.id } });
                                    }}
                                ></movie-faceoff-card>
                            </div>
                        </section>

                        <footer class="session-panel">
                            <div style="justify-self:start" role="group" aria-label="Current matchup actions">
                                <button
                                    class="secondary"
                                    ?disabled=${this.isTargetedMode}
                                    @click=${() => {
                                        void this.markBothMoviesUnseen();
                                    }}
                                >
                                    <jot-icon name="EyeOff"></jot-icon>
                                    Mark both unseen
                                </button>
                            </div>
                            <div class="feedback-bar">
                                <p class="status-chip ${statusTone}" role="status">
                                    ${statusTone === 'error'
                                        ? html`<jot-icon name="AlertTriangle"></jot-icon>`
                                        : html`<span class="status-dot" aria-hidden="true"></span>`}
                                    <span>${statusLabel}</span>
                                </p>
                                ${this.showUndo
                                    ? html`<button
                                          class="secondary"
                                          @click=${() => void this.undoLastAction()}
                                      >
                                          <jot-icon name="RotateCcw"></jot-icon>
                                          Undo
                                      </button>`
                                    : nothing}
                            </div>

                            <div class="summary-grid session-summary">
                                ${this.renderSummaryStat(
                                    'Ranked',
                                    this.visibleRankedMovies.length,
                                    true
                                )}
                                ${this.renderSummaryStat('Votes', movieFaceoff.allEvents.length)}
                                ${this.renderSummaryStat(
                                    'Available',
                                    this.availableMovieCount ?? '...'
                                )}
                            </div>



                            <p class="session-hint">
                                Keyboard shortcuts:
                                <kbd>Shift</kbd> + <kbd>Arrow</kbd> marks one movie unseen,
                                <kbd>Down</kbd> marks both.
                            </p>
                        </footer>
                    </article>
                </section>

                <aside class="rankings-column">
                    <movie-faceoff-rankings
                        .isTargetedMode=${!!this.targetedInsertion}
                        .sortMode=${this.sortMode}
                        @sort-change=${(e: CustomEvent) => {
                            this.sortMode = e.detail.sortMode;
                            this.updateQueryParams({
                                sort: this.sortMode === 'elo' ? undefined : this.sortMode,
                            });
                        }}
                        @exclude-movie=${(e: CustomEvent) => {
                            void this.excludeMovie(e.detail.movie);
                        }}
                        @restore-excluded=${(e: CustomEvent) => {
                            void this.restoreExcludedMovie(e.detail.movie);
                        }}
                        @restore-seen=${(e: CustomEvent) => {
                            void this.restoreSeenMovie(e.detail.movie);
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
            .surface-panel,
            .matchup,
            .matchup > *,
            .feedback-bar > * {
                min-width: 0;
            }
            .surface-panel {
                position: relative;
                overflow: hidden;
                margin: 0;
            }
            .targeted-banner {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                gap: 0.75rem;
                padding: 1rem;
                border-radius: var(--pico-border-radius);
                background: color-mix(
                    in srgb,
                    var(--pico-card-sectioning-background-color) 78%,
                    var(--pico-card-background-color)
                );
            }
            .targeted-meta {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .header-action-button {
                margin: 0;
                padding-inline: 0.7rem;
                min-height: 2.25rem;
            }
            .header-action-button span {
                display: inline-block;
            }
            .targeted-copy {
                min-width: 0;
            }
            .targeted-copy p:last-child {
                margin: 0;
                color: var(--pico-muted-color);
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
            .pool-toggle {
                width: fit-content;
            }
            .feedback-bar {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 0.75rem;
                align-items: center;
            }
            .summary-grid {
                display: grid;
                gap: 0.75rem;
                grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
            }
            .summary-stat {
                display: grid;
                gap: 0.35rem;
                margin: 0;
                padding: 0.85rem 1rem;
            }
            .summary-stat.accent {
                border-color: color-mix(
                    in srgb,
                    var(--pico-primary-border) 70%,
                    var(--pico-card-border-color)
                );
                background: color-mix(
                    in srgb,
                    var(--pico-primary-background) 16%,
                    var(--pico-card-background-color)
                );
            }
            .summary-stat p,
            .session-hint {
                margin: 0;
                color: var(--pico-muted-color);
            }
            .summary-stat strong {
                font-size: 1.1rem;
            }
            .session-panel {
                display: grid;
                gap: 1rem;
                background: transparent;
                border: 0;
            }
            .status-banner {
                display: flex;
                align-items: center;
                gap: 0.65rem;
                margin: 0;
            }
            .status-banner.error {
                color: var(--pico-del-color);
            }
            .status-chip {
                display: inline-flex;
                align-items: center;
                gap: 0.65rem;
                margin: 0;
                padding: 0.6rem 0.9rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .status-chip.error {
                color: var(--pico-del-color);
            }
            .status-dot {
                width: 0.6rem;
                height: 0.6rem;
                border-radius: 999px;
                background: var(--pico-ins-color);
                flex: none;
            }
            .status-chip.loading .status-dot {
                background: var(--pico-primary);
            }
            .status-chip.active .status-dot {
                background: var(--pico-secondary);
            }
            .matchup {
                position: relative;
                display: flex;
                gap: 1rem;
                align-items: start;
            }
            .matchup > * {
                flex: 1;
            }
            .matchup-divider {
                flex: none;
                display: grid;
                place-items: center;
                align-self: center;
            }
            .matchup-divider span {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 999px;
                background: var(--pico-card-sectioning-background-color);
                font-size: 0.75rem;
                font-weight: 700;
                letter-spacing: 0.08em;
            }
            kbd {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 1.5rem;
                padding: 0.12rem 0.35rem;
                border-radius: 0.4rem;
                font: inherit;
                font-size: 0.8em;
            }
            @media (min-width: 1320px) {
                .layout {
                    grid-template-columns: minmax(0, 1fr) 26rem;
                }
            }
            @media (max-width: 900px) {
                .pool-toggle {
                    width: 100%;
                }
            }
            @media (max-width: 640px) {
                :host {
                    width: 100%;
                }
                .targeted-banner,
                .header-action-button span {
                    display: none;
                }
                .targeted-meta {
                    align-items: stretch;
                }
                .pool-toggle {
                    width: 100%;
                }
                .pool-toggle button {
                    width: 100%;
                }
                .matchup {
                    gap: 0.55rem;
                    align-items: stretch;
                }
                .matchup-divider {
                    position: absolute;
                    inset: 34% auto auto 50%;
                    transform: translate(-50%, -50%);
                    z-index: 2;
                    pointer-events: none;
                }
                .matchup-divider span {
                    width: 1.85rem;
                    height: 1.85rem;
                    font-size: 0.56rem;
                    letter-spacing: 0.08em;
                }
                .feedback-bar,
                .feedback-bar button {
                    width: 100%;
                }
                .summary-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
            }
        `,
    ];
}
