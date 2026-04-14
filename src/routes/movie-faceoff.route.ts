import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation, WebComponentInterface } from '@vaadin/router';
import { base } from '../baseStyles';
import {
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
    buildMovieFaceoffReplayState,
    getMovieFaceoffRankingAlgorithm,
    getMovieFaceoffRankedMovies,
    MovieFaceoffReplayState,
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
    UndoEntry,
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
    private sortMode: MovieFaceoffSortMode = 'elo';

    @state()
    private useRankedOnly = false;

    @state()
    private useSmartSelection = true;

    @state()
    private editList = false;

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

    private undoManager = new MovieFaceoffUndoManager();
    private movieIdPool: number[] | null = null;
    private pendingTargetMovieId?: number;
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

        if (!this.routeInitialized) return;

        await this.maybeStartTargetedInsertionFromUrl();
    }

    connectedCallback() {
        super.connectedCallback();
        this.undoManager.restore();
        if (this.undoManager.hasEntries) {
            this.showUndo = true;
        }
        // Initialize settings from localStorage
        this.useSmartSelection = localStorage.getItem('movieFaceoff_smartSelection') !== 'false';
        void this.initializeRoute();
        window.addEventListener('keydown', this.keyDownHandler);
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this.keyDownHandler);
        // Clear cache to prevent memory leaks
        this.cachedReplayState = null;
        this.cachedReplayStateVersion = 0;
        super.disconnectedCallback();
    }

    private async initializeRoute() {
        await movieFaceoff.refresh();
        this.routeInitialized = true;
        const startedFromUrl = await this.maybeStartTargetedInsertionFromUrl();
        if (!startedFromUrl) {
            await this.displayNewPair();
        }
    }

    private cachedReplayState: MovieFaceoffReplayState | null = null;
    private cachedReplayStateVersion = 0;

    private get replayState() {
        // Check if we need to rebuild the replay state
        const currentVersion = movieFaceoff.allEvents.length + movieFaceoff.allMovies.length;
        if (!this.cachedReplayState || this.cachedReplayStateVersion !== currentVersion) {
            this.cachedReplayState = buildMovieFaceoffReplayState(
                movieFaceoff.allEvents,
                movieFaceoff.allMovies
            );
            this.cachedReplayStateVersion = currentVersion;
        }
        return this.cachedReplayState;
    }

    private get excludedMovies() {
        return [...movieFaceoff.allMovies]
            .filter((movie) => Boolean(movie.excludedAt))
            .sort(
                (a, b) =>
                    a.title.localeCompare(b.title) ||
                    b.updatedAt.localeCompare(a.updatedAt)
            );
    }

    private get unseenMovies() {
        return [...movieFaceoff.allMovies]
            .filter((movie) => Boolean(movie.unseenAt))
            .sort(
                (a, b) =>
                    a.title.localeCompare(b.title) ||
                    b.updatedAt.localeCompare(a.updatedAt)
            );
    }

    private get visibleRankedMovies() {
        return getMovieFaceoffRankedMovies(this.replayState, this.sortMode).filter(
            (movie) => !movie.excludedAt && !movie.unseenAt
        );
    }

    private get rankingAlgorithm() {
        return getMovieFaceoffRankingAlgorithm(this.sortMode);
    }

    private get totalVoteCount() {
        return movieFaceoff.allEvents.length;
    }

    private get rankedMovieCount() {
        return this.visibleRankedMovies.length;
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

    private snapshotCurrentPair() {
        return clonePair(this.movies);
    }

    private async setPoolMode(useRankedOnly: boolean) {
        if (this.useRankedOnly === useRankedOnly) return;
        this.useRankedOnly = useRankedOnly;
        await this.displayNewPair();
    }

    private async setSmartSelection(useSmartSelection: boolean) {
        if (this.useSmartSelection === useSmartSelection) return;
        this.useSmartSelection = useSmartSelection;
        localStorage.setItem('movieFaceoff_smartSelection', `${useSmartSelection}`);
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

    private pushUndoEntry(entry: UndoEntry) {
        this.undoManager.push(entry);
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
        this.errorMessage = '';
        this.showUndo = this.undoManager.hasEntries;
        this.statusMessage = 'Undid last action';

        if (this.targetedInsertion) {
            const nextState = this.buildTargetedInsertionState(
                this.targetedInsertion.targetMovie
            );
            this.targetedInsertion = nextState.complete ? null : nextState;
            if (nextState.complete) {
                this.pendingTargetMovieId = undefined;
                this.clearTargetedMovieQueryParam();
                this.statusMessage =
                    'Undid the last targeted vote. Targeted placement needs another ranked comparison.';
                await this.displayNewPair();
                return;
            }
            this.movies = [nextState.targetMovie, nextState.pivotMovie];
        }
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
                ? `Placed ${nextState.targetMovie.title} at #${estimatedPlacement} in ${this.rankingAlgorithm.label}.`
                : 'Saved that movie. Rank a few movies first, then use targeted placement.';
            await this.displayNewPair();
            return;
        }

        if (!options.preserveCurrentPair) {
            this.movies = [nextState.targetMovie, nextState.pivotMovie];
        }
    }

    private async startTargetedInsertion(movie: FaceoffMovie) {
        this.sortMode = 'manual';
        await movieFaceoff.upsertMoviesMetadata([movie]);

        const nextState = this.buildTargetedInsertionState(movie);
        this.targetedInsertion = nextState;

        if (nextState.complete) {
            const hasRankings = nextState.rankedSnapshot.length > 0;
            this.targetedInsertion = null;
            this.pendingTargetMovieId = undefined;
            this.clearTargetedMovieQueryParam();
            this.statusMessage = hasRankings
                ? `Placed ${movie.title} at #${nextState.low + 1} in ${this.rankingAlgorithm.label}.`
                : 'Saved that movie. Rank a few movies first, then use targeted placement.';
            await this.displayNewPair();
            this.errorMessage = hasRankings
                ? ''
                : 'Targeted placement needs at least one ranked movie to compare against.';
            return;
        }

        this.statusMessage = `Placing ${movie.title} using ${this.rankingAlgorithm.label}.`;
        this.errorMessage = '';
        this.movies = [movie, nextState.pivotMovie];
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
        if (typeof window === 'undefined') return;
        const search = new URLSearchParams(window.location.search);
        if (!search.has('targetMovieId')) return;
        betterGo('movie-faceoff');
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
            // Only use smart selection in "My movies" mode with smart pairing enabled
            const useSmart = this.useRankedOnly && this.useSmartSelection;
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
        } catch (error) {
            this.movies = [null, null];
            this.errorMessage =
                error instanceof Error ? error.message : 'Unable to load movies.';
        } finally {
            this.isLoading = false;
        }
    }

    private async replaceUnavailableMovie(index: 0 | 1) {
        if (this.targetedInsertion) {
            this.errorMessage = 'Targeted placement only supports choosing between the target and comparison movie.';
            return;
        }
        const existingMovies = this.movies.filter(Boolean) as FaceoffMovie[];
        const exclude = existingMovies.map((movie) => movie.id);
        const otherMovie = existingMovies.find(movie => movie.id !== this.movies[index]?.id);
        // Only use smart selection in "My movies" mode with smart pairing enabled
        const useSmart = this.useRankedOnly && this.useSmartSelection;
        const replacement = await (useSmart ? this.pickSmartMovie(exclude, otherMovie) : this.pickRandomMovie(exclude));
        if (!replacement) {
            await this.displayNewPair();
            return;
        }

        this.movies =
            index === 0
                ? [replacement, this.movies[1]]
                : [this.movies[0], replacement];
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

        const previousPair = this.snapshotCurrentPair();
        const winnerMovie = winnerIndex === 0 ? left : right;
        const loserMovie = winnerIndex === 0 ? right : left;
        const eventId = await movieFaceoff.recordVote(winnerMovie, loserMovie);

        this.pushUndoEntry({
            action: 'vote',
            eventId,
            pair: previousPair,
        });
        this.statusMessage = 'Recorded vote';
        this.showUndo = true;

        if (this.targetedInsertion) {
            const { low, high, comparisonsCompleted } = advanceTargetedInsertion(
                this.targetedInsertion,
                winnerIndex === 0
            );

            await this.refreshTargetedInsertion({
                comparisonsCompleted,
                low,
                high,
            });
            return;
        }

        await this.displayNewPair();
    }

    private async markMovieUnseen(index: 0 | 1) {
        const [left, right] = this.movies;
        if (!left || !right) return;

        const movie = index === 0 ? left : right;
        const previousPair = this.snapshotCurrentPair();
        const movieChanges = this.snapshotMovieChanges([movie.id]);
        await movieFaceoff.markMovieUnseen(movie.id);

        this.pushUndoEntry({
            action: index === 0 ? 'not-seen-left' : 'not-seen-right',
            movieChanges,
            pair: previousPair,
        });
        this.statusMessage = 'Marked as not seen';
        this.showUndo = true;

        if (this.targetedInsertion) {
            if (this.targetedInsertion.targetMovie.id === movie.id) {
                this.targetedInsertion = null;
                this.pendingTargetMovieId = undefined;
                this.clearTargetedMovieQueryParam();
                this.statusMessage = `Marked ${movie.title} as not seen and stopped targeted placement`;
                await this.displayNewPair();
                return;
            }

            await this.refreshTargetedInsertion({
                preserveCurrentPair: false,
            });
            return;
        }

        await this.replaceUnavailableMovie(index);
    }

    private async markBothMoviesUnseen() {
        const [left, right] = this.movies;
        if (!left || !right) return;

        const previousPair = this.snapshotCurrentPair();
        const movieChanges = this.snapshotMovieChanges([left.id, right.id]);
        await movieFaceoff.markMoviesUnseen([left.id, right.id]);
        this.pushUndoEntry({
            action: 'not-seen-both',
            movieChanges,
            pair: previousPair,
        });
        this.statusMessage = 'Marked both movies as not seen';
        this.showUndo = true;

        if (this.targetedInsertion) {
            this.targetedInsertion = null;
            this.pendingTargetMovieId = undefined;
            this.clearTargetedMovieQueryParam();
        }
        await this.displayNewPair();
    }

    private async excludeMovie(movie: MovieFaceoffRankedMovie) {
        const previousPair = this.snapshotCurrentPair();
        const movieChanges = this.snapshotMovieChanges([movie.id]);
        await movieFaceoff.excludeMovie(movie.id);
        this.pushUndoEntry({
            action: 'exclude',
            movieChanges,
            pair: previousPair,
        });
        this.statusMessage = `Excluded ${movie.title}`;
        this.showUndo = true;

        const currentIds = this.movies
            .filter(Boolean)
            .map((currentMovie) => currentMovie!.id);
        if (currentIds.includes(movie.id)) {
            await this.displayNewPair();
        }
    }

    private async restoreExcludedMovie(movie: MovieFaceoffMovie) {
        const previousPair = this.snapshotCurrentPair();
        const movieChanges = this.snapshotMovieChanges([movie.id]);
        await movieFaceoff.restoreMovie(movie.id);
        this.pushUndoEntry({
            action: 'restore-excluded',
            movieChanges,
            pair: previousPair,
        });
        this.statusMessage = `Restored ${movie.title}`;
        this.showUndo = true;
    }

    private async restoreSeenMovie(movie: MovieFaceoffMovie) {
        const previousPair = this.snapshotCurrentPair();
        const movieChanges = this.snapshotMovieChanges([movie.id]);
        await movieFaceoff.restoreMovieSeen(movie.id);
        this.pushUndoEntry({
            action: 'restore-seen',
            movieChanges,
            pair: previousPair,
        });
        this.statusMessage = `Marked ${movie.title} as seen again`;
        this.showUndo = true;
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
                    <p class="eyebrow">Targeted placement</p>
                    <h3>${session.targetMovie.title}</h3>
                    <p>
                        Compare it against key movies in ${this.rankingAlgorithm.label}.
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
        const ranked = this.visibleRankedMovies;
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
                    <span>Add movie</span>
                </button>
            </utility-page-header>
            <main class="layout">
                <section class="faceoff-column">
                    <article class="faceoff-panel surface-panel">
                        <header class="panel-header">
                            <div>
                                <p class="eyebrow">Which would you rather watch?</p>
                                <h2>Current faceoff</h2>
                            </div>
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

                        ${this.useRankedOnly
                            ? html`<div class="selection-controls">
                                  <label class="smart-selection-label">
                                      <input
                                          type="checkbox"
                                          .checked=${this.useSmartSelection}
                                          ?disabled=${this.isTargetedMode}
                                          @change=${(event: Event) => {
                                              const target = event.target as HTMLInputElement;
                                              void this.setSmartSelection(target.checked);
                                          }}
                                      />
                                      <span>Smart pairing</span>
                                  </label>
                              </div>`
                            : nothing}

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
                                ></movie-faceoff-card>
                            </div>
                        </section>

                        <footer class="session-panel">
                            <div class="matchup-actions" role="group" aria-label="Current matchup actions">
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
                                    this.rankedMovieCount,
                                    true
                                )}
                                ${this.renderSummaryStat('Votes', this.totalVoteCount)}
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
                        .rankedMovies=${ranked}
                        .excludedMovies=${this.excludedMovies}
                        .unseenMovies=${this.unseenMovies}
                        .sortMode=${this.sortMode}
                        .editList=${this.editList}
                        .isTargetedMode=${this.isTargetedMode}
                        .rankingAlgorithm=${this.rankingAlgorithm}
                        @sort-mode-change=${(e: CustomEvent) => {
                            this.sortMode = e.detail.sortMode as MovieFaceoffSortMode;
                        }}
                        @toggle-edit=${() => {
                            this.editList = !this.editList;
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
                    ></movie-faceoff-rankings>
                </aside>
            </main>
        `;
    }

    static styles = [
        base,
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
                gap: 0.75rem;
                padding: 1rem;
                border-radius: var(--pico-border-radius);
                background: color-mix(
                    in srgb,
                    var(--pico-card-sectioning-background-color) 78%,
                    var(--pico-card-background-color)
                );
            }
            .targeted-banner {
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
            }
            .targeted-meta {
                display: flex;
                gap: 0.75rem;
                align-items: start;
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
            .targeted-copy,
            .search-result-copy {
                min-width: 0;
            }
            .targeted-copy h3 {
                margin: 0;
            }
            .targeted-copy p:last-child,
            .search-feedback,
            .targeted-card-label {
                margin: 0;
                color: var(--pico-muted-color);
            }
            .targeted-meta {
                flex-direction: column;
                align-items: flex-end;
            }
            .faceoff-panel {
                display: grid;
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
            .panel-header h2 {
                margin: 0;
            }
            .eyebrow {
                margin: 0 0 0.2rem;
                color: var(--pico-muted-color);
                font-size: 0.78rem;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }
            .faceoff-panel > * {
                position: relative;
                z-index: 1;
            }
            .pool-toggle {
                width: fit-content;
            }
            .selection-controls {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                margin-top: 0.5rem;
                padding: 0.5rem 0;
            }
            .smart-selection-label {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                cursor: pointer;
                margin: 0;
                user-select: none;
            }
            .smart-selection-label input[type="checkbox"] {
                margin: 0;
                cursor: pointer;
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
            .matchup-actions {
                justify-self: start;
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
