import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import TinyGesture from 'tinygesture';
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
    getMoviePosterUrl,
} from '../services/movie-faceoff.service';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import {
    buildMovieFaceoffReplayState,
    getMovieFaceoffRankingAlgorithm,
    getMovieFaceoffRankedMovies,
    MOVIE_FACEOFF_RANKING_ALGORITHMS,
} from '../utils/movie-faceoff-rankings';
import '../components/jot-icon';
import '../components/utility-page-header.component';

type FaceoffPair = [FaceoffMovie | null, FaceoffMovie | null];
type UndoAction =
    | 'vote'
    | 'not-seen-left'
    | 'not-seen-right'
    | 'not-seen-both'
    | 'exclude'
    | 'restore-excluded'
    | 'restore-seen';

type MovieStateChange = {
    movieId: number;
    previousExcludedAt?: string;
    previousUnseenAt?: string;
};

type UndoEntry = {
    action: UndoAction;
    eventId?: number;
    movieChanges?: MovieStateChange[];
    pair: FaceoffPair;
};

const MAX_UNDO_ENTRIES = 25;
const UNDO_STACK_STORAGE_KEY = 'movie-faceoff-undo-stack-v2';

function clonePair(pair: FaceoffPair): FaceoffPair {
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

function isUndoEntry(entry: unknown): entry is UndoEntry {
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
            'restore-seen',
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

@customElement('movie-faceoff-route')
export class MovieFaceoffRoute extends MobxLitElement {
    @state()
    private movies: FaceoffPair = [null, null];

    @state()
    private sortMode: MovieFaceoffSortMode = 'elo';

    @state()
    private useRankedOnly = false;

    @state()
    private editList = false;

    @state()
    private isLoading = false;

    @state()
    private errorMessage = '';

    @state()
    private statusMessage = '';

    @state()
    private showUndo = false;

    @state()
    private showAlgorithmInfo = false;

    @state()
    private swipeOffsets: [number, number] = [0, 0];

    @state()
    private swipeIntent: ['' | 'skip', '' | 'skip'] = ['', ''];

    private undoStack: UndoEntry[] = [];
    private movieIdPool: number[] | null = null;
    private gestureHosts: Array<HTMLElement | undefined> = [];
    private gestures: Array<TinyGesture<HTMLElement> | undefined> = [];
    private swipeActionTimers: Array<number | undefined> = [];
    private swipeSettling: [boolean, boolean] = [false, false];
    private readonly keyDownHandler = (event: KeyboardEvent) =>
        this.handleKeyDown(event);

    connectedCallback() {
        super.connectedCallback();
        this.restoreUndoStack();
        if (this.undoStack.length) {
            this.showUndo = true;
        }
        void this.initializeRoute();
        window.addEventListener('keydown', this.keyDownHandler);
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this.keyDownHandler);
        this.gestures.forEach((gesture) => gesture?.destroy());
        this.swipeActionTimers.forEach((timer) => {
            if (timer) window.clearTimeout(timer);
        });
        super.disconnectedCallback();
    }

    updated() {
        this.attachGestures();
    }

    private async initializeRoute() {
        await movieFaceoff.refresh();
        await this.displayNewPair();
    }

    private get replayState() {
        return buildMovieFaceoffReplayState(
            movieFaceoff.allEvents,
            movieFaceoff.allMovies
        );
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
        if (this.showUndo) return 'active';
        return 'idle';
    }

    private get sessionStatusLabel() {
        if (this.errorMessage) return 'Needs attention';
        if (this.isLoading) return 'Loading next matchup';
        return 'Ready for the next pick';
    }

    private snapshotCurrentPair() {
        return clonePair(this.movies);
    }

    private async setPoolMode(useRankedOnly: boolean) {
        if (this.useRankedOnly === useRankedOnly) return;
        this.useRankedOnly = useRankedOnly;
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

    private persistUndoStack() {
        try {
            window.sessionStorage.setItem(
                UNDO_STACK_STORAGE_KEY,
                JSON.stringify(this.undoStack)
            );
        } catch (_error) {
            // Ignore storage failures; undo remains best effort.
        }
    }

    private restoreUndoStack() {
        try {
            const raw = window.sessionStorage.getItem(UNDO_STACK_STORAGE_KEY);
            if (!raw) return;
            const parsed: unknown = JSON.parse(raw);
            if (!Array.isArray(parsed)) return;
            this.undoStack = parsed.filter(isUndoEntry);
        } catch (_error) {
            this.undoStack = [];
        }
        this.showUndo = this.undoStack.length > 0;
    }

    private pushUndoEntry(entry: UndoEntry) {
        this.undoStack.push({
            ...entry,
            pair: clonePair(entry.pair),
        });
        this.undoStack = this.undoStack.slice(-MAX_UNDO_ENTRIES);
        this.persistUndoStack();
        this.showUndo = true;
    }

    private async undoLastAction() {
        const entry = this.undoStack.pop();
        if (!entry) return;

        this.persistUndoStack();

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
        this.resetSwipeState(0);
        this.resetSwipeState(1);
        this.showUndo = this.undoStack.length > 0;
        this.statusMessage = 'Undid last action';
    }

    private async ensureMovieIdPool() {
        if (this.movieIdPool) return this.movieIdPool;
        this.movieIdPool = await fetchMovieFaceoffIds();
        return this.movieIdPool;
    }

    private async getCandidatePool(exclude: number[] = []) {
        const excludedIds = movieFaceoff.excludedMovieIds;
        const unseenIds = movieFaceoff.unseenMovieIds;
        if (this.useRankedOnly) {
            return Array.from(this.replayState.decisiveMovieIds).filter(
                (id) =>
                    !excludedIds.has(id) &&
                    !unseenIds.has(id) &&
                    !exclude.includes(id)
            );
        }

        return (await this.ensureMovieIdPool()).filter(
            (id) =>
                !excludedIds.has(id) &&
                !unseenIds.has(id) &&
                !exclude.includes(id)
        );
    }

    private async getRandomMovie(exclude: number[] = []): Promise<FaceoffMovie | null> {
        const pool = await this.getCandidatePool(exclude);
        if (!pool.length) return null;

        const candidateIds = [...pool];
        while (candidateIds.length) {
            const index = Math.floor(Math.random() * candidateIds.length);
            const [id] = candidateIds.splice(index, 1);
            try {
                const movie = await fetchTmdbMovie(id);
                await movieFaceoff.upsertMoviesMetadata([movie]);
                return movie;
            } catch (_error) {
                continue;
            }
        }

        return null;
    }

    private async displayNewPair() {
        this.isLoading = true;
        this.errorMessage = '';
        try {
            const left = await this.getRandomMovie();
            if (!left) {
                this.movies = [null, null];
                this.errorMessage = this.useRankedOnly
                    ? 'Rank at least two movies before using ranked-only mode.'
                    : 'No movies are available right now.';
                return;
            }

            const right = await this.getRandomMovie([left.id]);
            if (!right) {
                this.movies = [left, null];
                this.errorMessage = this.useRankedOnly
                    ? 'Rank at least two movies before using ranked-only mode.'
                    : 'Unable to find a second movie right now.';
                return;
            }

            this.movies = [left, right];
            this.resetSwipeState(0);
            this.resetSwipeState(1);
        } catch (error) {
            this.movies = [null, null];
            this.errorMessage =
                error instanceof Error ? error.message : 'Unable to load movies.';
        } finally {
            this.isLoading = false;
        }
    }

    private async replaceUnavailableMovie(index: 0 | 1) {
        const existingMovies = this.movies.filter(Boolean) as FaceoffMovie[];
        const exclude = existingMovies.map((movie) => movie.id);
        const replacement = await this.getRandomMovie(exclude);
        if (!replacement) {
            await this.displayNewPair();
            return;
        }

        this.movies =
            index === 0
                ? [replacement, this.movies[1]]
                : [this.movies[0], replacement];
        this.resetSwipeState(index);
    }

    private attachGestures() {
        ([0, 1] as const).forEach((index) => {
            const stage = this.renderRoot?.querySelector<HTMLElement>(
                `.movie-swipe-stage[data-index="${index}"]`
            );

            if (!stage) {
                this.gestures[index]?.destroy();
                this.gestures[index] = undefined;
                this.gestureHosts[index] = undefined;
                return;
            }

            if (this.gestureHosts[index] === stage && this.gestures[index]) return;

            this.gestures[index]?.destroy();
            const gesture = new TinyGesture(stage, {
                threshold: () => Math.max(45, Math.floor(window.innerWidth * 0.12)),
                mouseSupport: true,
            });

            gesture.on('panmove', () => {
                if (this.swipeSettling[index]) return;
                if (
                    gesture.swipingDirection !== 'horizontal' &&
                    gesture.swipingDirection !== 'pre-horizontal'
                ) {
                    return;
                }

                const rawOffset = gesture.touchMoveX ?? 0;
                const constrainedOffset =
                    index === 0
                        ? Math.max(-132, Math.min(0, rawOffset))
                        : Math.max(0, Math.min(132, rawOffset));

                const nextOffsets: [number, number] = [...this.swipeOffsets] as [
                    number,
                    number,
                ];
                nextOffsets[index] = constrainedOffset;
                this.swipeOffsets = nextOffsets;

                const nextIntent: ['' | 'skip', '' | 'skip'] = [
                    ...this.swipeIntent,
                ] as ['' | 'skip', '' | 'skip'];
                nextIntent[index] =
                    (index === 0 && constrainedOffset < -12) ||
                    (index === 1 && constrainedOffset > 12)
                        ? 'skip'
                        : '';
                this.swipeIntent = nextIntent;
            });

            gesture.on('panend', () => {
                if (this.swipeSettling[index]) return;
                const releaseOffset = this.swipeOffsets[index];
                const releaseIntent = this.swipeIntent[index];
                if (Math.abs(releaseOffset) >= 72 && releaseIntent === 'skip') {
                    this.commitSwipe(index);
                    return;
                }
                window.requestAnimationFrame(() => this.resetSwipeState(index));
            });

            if (index === 0) {
                gesture.on('swipeleft', () => this.commitSwipe(index));
            } else {
                gesture.on('swiperight', () => this.commitSwipe(index));
            }

            this.gestures[index] = gesture;
            this.gestureHosts[index] = stage;
        });
    }

    private handleKeyDown(event: KeyboardEvent) {
        if (this.showAlgorithmInfo) {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.showAlgorithmInfo = false;
            }
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
        this.resetSwipeState(0);
        this.resetSwipeState(1);
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

    private renderRankValue(movie: MovieFaceoffRankedMovie) {
        return this.rankingAlgorithm.formatMetric(movie);
    }

    private renderSummaryStat(label: string, value: string | number, accent = false) {
        return html`
            <div class="summary-stat ${accent ? 'accent' : ''}">
                <span class="summary-stat-value">${value}</span>
                <span class="summary-stat-label">${label}</span>
            </div>
        `;
    }

    private renderMoviePlaceholder(index: 0 | 1) {
        const label =
            index === 0 ? 'First movie placeholder' : 'Second movie placeholder';
        const message = this.isLoading ? 'Loading a fresh movie...' : 'No movie loaded';

        return html`
            <article class="movie-card placeholder-card" aria-label=${label}>
                <div class="placeholder-poster">
                    <jot-icon name="Play" size="large"></jot-icon>
                </div>
                <div class="placeholder-copy">
                    <h5>${message}</h5>
                    <p>
                        ${this.errorMessage
                            ? 'Try again once the catalog is available.'
                            : 'The next matchup will appear here.'}
                    </p>
                </div>
            </article>
        `;
    }

    private resetSwipeState(index: 0 | 1) {
        const nextOffsets: [number, number] = [...this.swipeOffsets] as [number, number];
        nextOffsets[index] = 0;
        this.swipeOffsets = nextOffsets;

        const nextIntent: ['' | 'skip', '' | 'skip'] = [...this.swipeIntent] as [
            '' | 'skip',
            '' | 'skip',
        ];
        nextIntent[index] = '';
        this.swipeIntent = nextIntent;
        this.swipeSettling[index] = false;
    }

    private commitSwipe(index: 0 | 1) {
        if (this.swipeSettling[index]) return;
        this.swipeSettling[index] = true;

        const nextIntent: ['' | 'skip', '' | 'skip'] = [...this.swipeIntent] as [
            '' | 'skip',
            '' | 'skip',
        ];
        nextIntent[index] = 'skip';
        this.swipeIntent = nextIntent;

        const nextOffsets: [number, number] = [...this.swipeOffsets] as [number, number];
        nextOffsets[index] = index === 0 ? -180 : 180;
        this.swipeOffsets = nextOffsets;

        if (this.swipeActionTimers[index]) {
            window.clearTimeout(this.swipeActionTimers[index]);
        }

        this.swipeActionTimers[index] = window.setTimeout(() => {
            this.swipeActionTimers[index] = undefined;
            void this.markMovieUnseen(index);
        }, 140);
    }

    private renderMovie(movie: FaceoffMovie, index: 0 | 1) {
        const imageUrl = getMoviePosterUrl(movie);
        const swipeProgress = Math.min(Math.abs(this.swipeOffsets[index]) / 132, 1);
        const year = movie.release_date?.split('-')[0] || 'Unknown year';

        return html`
            <div
                class="movie-swipe-stage ${this.swipeIntent[index] ? 'skip' : ''}"
                data-index=${index}
                style=${`--swipe-progress:${swipeProgress};`}
            >
                <div class="swipe-hint ${index === 0 ? 'left' : 'right'}">
                    Not seen
                </div>
                <article
                    class="movie-card"
                    style=${`transform: translateX(${this.swipeOffsets[index]}px) rotate(${this.swipeOffsets[index] * 0.04}deg);`}
                >
                    ${imageUrl
                        ? html`<button
                              class="poster-button"
                              aria-label=${`Pick ${movie.title}`}
                              @click=${() => {
                                  void this.vote(index);
                              }}
                          >
                              <img src=${imageUrl} alt=${movie.title} />
                          </button>`
                        : html`<button
                              class="poster-button poster-fallback"
                              aria-label=${`Pick ${movie.title}`}
                              @click=${() => {
                                  void this.vote(index);
                              }}
                          >
                              <jot-icon name="Play" size="large"></jot-icon>
                              <span>No poster available</span>
                          </button>`}
                    <div class="movie-copy">
                        <div class="movie-title-row">
                            <h5 title=${movie.title}>${movie.title}</h5>
                            <span class="movie-title-year">${year}</span>
                        </div>
                    </div>
                    <div class="movie-actions">
                        <button
                            class="ghost-action"
                            @click=${() => {
                                void this.markMovieUnseen(index);
                            }}
                        >
                            <jot-icon name="EyeOff"></jot-icon>
                            Not seen
                        </button>
                        <button
                            class="primary-vote-action"
                            @click=${() => {
                                void this.vote(index);
                            }}
                        >
                            Choose
                        </button>
                    </div>
                </article>
            </div>
        `;
    }

    private renderAlgorithmInfoModal() {
        if (!this.showAlgorithmInfo) return nothing;

        const descriptionParts = this.rankingAlgorithm.description
            .split('\n\n')
            .filter(Boolean);

        return html`
            <div
                class="algorithm-modal-backdrop"
                @click=${() => {
                    this.showAlgorithmInfo = false;
                }}
            >
                <article
                    class="algorithm-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="algorithm-info-title"
                    @click=${(event: Event) => event.stopPropagation()}
                >
                    <header class="algorithm-modal-header">
                        <div>
                            <p class="algorithm-modal-eyebrow">
                                Current ranking method
                            </p>
                            <h3 id="algorithm-info-title">
                                ${this.rankingAlgorithm.label}
                            </h3>
                        </div>
                        <button
                            class="secondary"
                            @click=${() => {
                                this.showAlgorithmInfo = false;
                            }}
                        >
                            Close
                        </button>
                    </header>
                    <div class="algorithm-modal-body">
                        ${descriptionParts.map(
                            (paragraph) => html`<p>${paragraph}</p>`
                        )}
                    </div>
                </article>
            </div>
        `;
    }

    render() {
        const ranked = this.visibleRankedMovies;
        const [left, right] = this.movies;
        const statusTone = this.sessionStatusTone;
        const statusLabel = this.statusMessage || this.sessionStatusLabel;
        const leftPoster = left ? getMoviePosterUrl(left) : '';
        const rightPoster = right ? getMoviePosterUrl(right) : '';

        return html`
            <utility-page-header title="Movie Faceoff"></utility-page-header>
            <section class="layout">
                <article class="faceoff-panel">
                    <div class="cinema-backdrop" aria-hidden="true">
                        <div
                            class="backdrop-panel left ${leftPoster ? 'has-image' : ''}"
                            style=${leftPoster
                                ? `background-image:url(${leftPoster});`
                                : ''}
                        ></div>
                        <div
                            class="backdrop-panel right ${rightPoster ? 'has-image' : ''}"
                            style=${rightPoster
                                ? `background-image:url(${rightPoster});`
                                : ''}
                        ></div>
                    </div>

                    <div class="faceoff-shell">
                        <div class="faceoff-header">
                            <div class="pool-toggle" aria-label="Movie pool">
                                <button
                                    class=${this.useRankedOnly ? '' : 'active'}
                                    @click=${() => {
                                        void this.setPoolMode(false);
                                    }}
                                >
                                    All movies
                                </button>
                                <button
                                    class=${this.useRankedOnly ? 'active' : ''}
                                    @click=${() => {
                                        void this.setPoolMode(true);
                                    }}
                                >
                                    My movies
                                </button>
                            </div>
                        </div>

                        ${this.errorMessage
                            ? html`<div class="status-banner error" role="alert">
                                  <jot-icon name="AlertTriangle"></jot-icon>
                                  <span>${this.errorMessage}</span>
                              </div>`
                            : nothing}

                        <div class="matchup-shell">
                            <div class="matchup">
                                ${left
                                    ? this.renderMovie(left, 0)
                                    : this.renderMoviePlaceholder(0)}
                                <div class="matchup-divider" aria-hidden="true">
                                    <span>VS</span>
                                </div>
                                ${right
                                    ? this.renderMovie(right, 1)
                                    : this.renderMoviePlaceholder(1)}
                            </div>
                        </div>

                        <div class="matchup-actions" aria-label="Current matchup actions">
                            <button
                                class="ghost-action wide-action"
                                @click=${() => {
                                    void this.markBothMoviesUnseen();
                                }}
                            >
                                <jot-icon name="EyeOff"></jot-icon>
                                Mark both unseen
                            </button>
                        </div>

                        <div class="feedback-bar">
                            <span class="session-pill status ${statusTone}" role="status">
                                <span class="status-dot"></span>
                                <span>${statusLabel}</span>
                            </span>
                            ${this.showUndo
                                ? html`<button
                                      class="status-action"
                                      @click=${() => void this.undoLastAction()}
                                  >
                                      <jot-icon name="RotateCcw"></jot-icon>
                                      Undo
                                  </button>`
                                : nothing}
                        </div>

                        <div class="session-panel">
                            <div class="session-secondary">
                                <div class="summary-grid session-summary">
                                    ${this.renderSummaryStat(
                                        'Ranked',
                                        this.rankedMovieCount,
                                        true
                                    )}
                                    ${this.renderSummaryStat(
                                        'Votes',
                                        this.totalVoteCount
                                    )}
                                    ${this.renderSummaryStat(
                                        'Available',
                                        this.availableMovieCount ?? '...'
                                    )}
                                </div>
                            </div>

                            <p class="session-hint">
                                Swipe outward for not seen. Keyboard shortcuts:
                                <kbd>Shift</kbd> + <kbd>Arrow</kbd> marks one movie unseen,
                                <kbd>Down</kbd> marks both.
                            </p>
                        </div>
                    </div>
                </article>

                <article class="rankings-panel">
                    <header class="rankings-header">
                        <div class="rankings-heading">
                            <h2>Rankings</h2>
                            <p class="panel-description">
                                ${ranked.length
                                    ? `${ranked.length} movies ranked so far`
                                    : 'Vote a few times to start building your list.'}
                            </p>
                        </div>
                        <div class="rankings-actions">
                            <label class="ranking-select-field">
                                <span>Sort by</span>
                                <select
                                    .value=${this.sortMode}
                                    @change=${(event: Event) => {
                                        this.sortMode = (
                                            event.currentTarget as HTMLSelectElement
                                        ).value as MovieFaceoffSortMode;
                                    }}
                                >
                                    ${MOVIE_FACEOFF_RANKING_ALGORITHMS.map(
                                        (algorithm) => html`
                                            <option value=${algorithm.id}>
                                                ${algorithm.label}
                                            </option>
                                        `
                                    )}
                                </select>
                            </label>
                            <button
                                class="ghost-action info-button"
                                title="About the current ranking method"
                                aria-label="About the current ranking method"
                                @click=${() => {
                                    this.showAlgorithmInfo = true;
                                }}
                            >
                                <jot-icon name="Info"></jot-icon>
                                About
                            </button>
                            <button
                                class="ghost-action"
                                @click=${() => {
                                    this.editList = !this.editList;
                                }}
                            >
                                ${this.editList ? 'Done' : 'Edit'}
                            </button>
                        </div>
                    </header>

                    ${ranked.length
                        ? html`<ol class="rank-list">
                              ${ranked.map(
                                  (movie, index) => {
                                      const posterUrl = movie.posterPath
                                          ? getMoviePosterUrl({
                                                poster_path: movie.posterPath,
                                            })
                                          : '';

                                      return html`
                                          <li class="rank-row">
                                              <span class="rank-index">${index + 1}</span>
                                              <span class="rank-poster" aria-hidden="true">
                                                  ${posterUrl
                                                      ? html`<img
                                                            src=${posterUrl}
                                                            alt=""
                                                            loading="lazy"
                                                        />`
                                                      : html`<span
                                                            class="rank-poster-fallback"
                                                        >
                                                            <jot-icon
                                                                name="Play"
                                                            ></jot-icon>
                                                        </span>`}
                                              </span>
                                              <span class="rank-item">
                                                  <span class="rank-title-group">
                                                      <span class="rank-title"
                                                          >${movie.title}</span
                                                      >
                                                      <span class="rank-subtitle"
                                                          >${movie.releaseDate?.split('-')[0] ||
                                                          'Unknown year'}</span
                                                      >
                                                  </span>
                                                  <span class="rank-meta">
                                                      <span class="rank-score"
                                                          >${this.renderRankValue(
                                                              movie
                                                          )}</span
                                                      >
                                                      ${this.editList
                                                          ? html`<button
                                                                class="delete-button"
                                                                @click=${() =>
                                                                    void this.excludeMovie(
                                                                        movie
                                                                    )}
                                                            >
                                                                Exclude
                                                            </button>`
                                                          : nothing}
                                                  </span>
                                              </span>
                                          </li>
                                      `;
                                  }
                              )}
                          </ol>`
                        : html`<div class="empty-state-panel">
                              <jot-icon name="TrendingUp" size="large"></jot-icon>
                              <p>Your rankings will appear here after a few faceoffs.</p>
                          </div>`}

                    ${this.editList && this.excludedMovies.length
                        ? html`
                              <section class="excluded-section">
                                  <header class="page-subheader">
                                      <h3>Excluded</h3>
                                      <small>${this.excludedMovies.length}</small>
                                  </header>
                                  <ul class="excluded-list">
                                          ${this.excludedMovies.map(
                                              (movie) => html`
                                                  <li class="excluded-item">
                                                      <span class="excluded-copy">
                                                          <strong>${movie.title}</strong>
                                                          <small>Hidden from the active pool</small>
                                                      </span>
                                                      <button
                                                          class="ghost-action"
                                                          @click=${() =>
                                                              void this.restoreExcludedMovie(
                                                                  movie
                                                              )}
                                                      >
                                                          Restore
                                                      </button>
                                              </li>
                                          `
                                      )}
                                  </ul>
                              </section>
                          `
                        : nothing}

                    ${this.editList && this.unseenMovies.length
                        ? html`
                              <section class="excluded-section">
                                  <header class="page-subheader">
                                      <h3>Not Seen</h3>
                                      <small>${this.unseenMovies.length}</small>
                                  </header>
                                  <ul class="excluded-list">
                                          ${this.unseenMovies.map(
                                              (movie) => html`
                                                  <li class="excluded-item">
                                                      <span class="excluded-copy">
                                                          <strong>${movie.title}</strong>
                                                          <small>Skipped because you have not seen it</small>
                                                      </span>
                                                      <button
                                                          class="ghost-action"
                                                          @click=${() =>
                                                              void this.restoreSeenMovie(
                                                                  movie
                                                              )}
                                                      >
                                                          Mark seen
                                                      </button>
                                              </li>
                                          `
                                      )}
                                  </ul>
                              </section>
                          `
                        : nothing}
                </article>
            </section>
            ${this.renderAlgorithmInfoModal()}
        `;
    }

    static styles = [
        base,
        css`
            :host {
                --faceoff-shell: linear-gradient(
                    180deg,
                    color-mix(in srgb, #1f2430 30%, #090b10) 0%,
                    #090b10 52%,
                    #050608 100%
                );
                --faceoff-surface: color-mix(
                    in srgb,
                    var(--pico-card-background-color) 62%,
                    #0c1016
                );
                --faceoff-surface-strong: color-mix(
                    in srgb,
                    var(--pico-card-background-color) 28%,
                    #080b11
                );
                --faceoff-border: color-mix(
                    in srgb,
                    white 12%,
                    transparent
                );
                --faceoff-accent: #e50914;
                --faceoff-accent-strong: #ff6b59;
                --faceoff-shadow: 0 2rem 4rem rgba(0, 0, 0, 0.4);
                display: flex;
                flex-direction: column;
                gap: 1.15rem;
                width: min(100%, 94rem);
                margin-inline: auto;
            }
            .layout {
                display: grid;
                gap: 1.15rem;
                grid-template-columns: minmax(0, 1fr);
                align-items: start;
                width: min(100%, 78rem);
                margin-inline: auto;
            }
            .faceoff-panel,
            .rankings-panel {
                margin: 0;
                border: 1px solid var(--faceoff-border);
                box-shadow: var(--faceoff-shadow);
            }
            .faceoff-panel {
                position: relative;
                overflow: hidden;
                background:
                    radial-gradient(circle at top left, rgba(255, 255, 255, 0.06), transparent 32%),
                    radial-gradient(circle at 78% 12%, rgba(229, 9, 20, 0.22), transparent 24%),
                    var(--faceoff-shell);
                color: white;
                padding: clamp(1rem, 1rem + 1vw, 1.8rem);
                border-radius: 1.8rem;
            }
            .faceoff-panel::before {
                content: '';
                position: absolute;
                inset: 0;
                background:
                    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 24%),
                    linear-gradient(0deg, rgba(0, 0, 0, 0.4), transparent 45%);
                pointer-events: none;
            }
            .faceoff-panel > * {
                position: relative;
                z-index: 1;
            }
            .faceoff-shell {
                display: grid;
                gap: 1.5rem;
            }
            .cinema-backdrop {
                position: absolute;
                inset: 0;
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                opacity: 0.42;
                pointer-events: none;
            }
            .backdrop-panel {
                background:
                    radial-gradient(circle at center, rgba(255, 255, 255, 0.06), transparent 52%),
                    linear-gradient(180deg, rgba(12, 15, 20, 0.2), rgba(5, 6, 8, 0.88));
                background-size: cover;
                background-position: center;
                filter: saturate(0.9) blur(24px);
                transform: scale(1.08);
            }
            .backdrop-panel.has-image {
                background-blend-mode: screen, normal;
            }
            .rankings-panel {
                position: relative;
                overflow: hidden;
                background: color-mix(
                    in srgb,
                    var(--pico-card-background-color) 52%,
                    #0a0d12
                );
                color: white;
                width: min(100%, 28rem);
                margin-inline: auto;
                border-radius: 1.8rem;
                padding: 1.1rem;
            }
            .rankings-panel::before {
                content: '';
                position: absolute;
                inset: 0;
                background:
                    radial-gradient(circle at top right, rgba(255, 255, 255, 0.05), transparent 30%),
                    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent 26%);
                pointer-events: none;
            }
            .rankings-panel > * {
                position: relative;
                z-index: 1;
            }
            .faceoff-header {
                display: flex;
                justify-content: center;
            }
            .rankings-header h2 {
                margin: 0;
                font-size: clamp(1.7rem, 1.15rem + 1.5vw, 2.45rem);
                line-height: 1;
                letter-spacing: -0.03em;
            }
            .matchup-actions,
            .feedback-bar,
            .rankings-header > div,
            .rankings-actions,
            .ranking-select-field,
            .rank-item,
            .rank-title-group,
            .movie-copy,
            .placeholder-copy {
                min-width: 0;
            }
            .pool-toggle {
                display: inline-grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0.2rem;
                padding: 0.2rem;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.06);
            }
            .pool-toggle button {
                margin: 0;
                min-height: 2rem;
                padding: 0.4rem 0.8rem;
                border: 0;
                border-radius: 999px;
                background: transparent;
                color: color-mix(in srgb, white 72%, transparent);
                font-size: 0.82rem;
                font-weight: 600;
            }
            .pool-toggle button.active {
                background: rgba(255, 255, 255, 0.14);
                color: white;
            }
            .feedback-bar {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 0.45rem;
                align-items: center;
                width: 100%;
            }
            .feedback-bar > * {
                min-width: 0;
            }
            .session-pill {
                display: inline-flex;
                align-items: center;
                gap: 0.45rem;
                min-height: 2.25rem;
                padding: 0.5rem 0.8rem;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(255, 255, 255, 0.06);
                color: color-mix(in srgb, white 86%, transparent);
                font-size: 0.82rem;
            }
            .session-pill.status {
                width: 100%;
            }
            .session-pill.status.active,
            .session-pill.status.loading,
            .session-pill.status.idle {
                background: rgba(10, 13, 18, 0.62);
            }
            .session-pill.status.error {
                background: color-mix(in srgb, var(--pico-del-color) 16%, rgba(255, 255, 255, 0.05));
                border-color: color-mix(in srgb, var(--pico-del-color) 35%, transparent);
            }
            .status-action {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.45rem;
                min-height: 2.25rem;
                margin: 0;
                padding: 0.5rem 0.8rem;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.12);
                background: rgba(255, 255, 255, 0.08);
                color: white;
            }
            .summary-grid {
                display: grid;
                gap: 0.55rem;
                grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
            }
            .summary-stat {
                display: grid;
                gap: 0.12rem;
                padding: 0.75rem 0.85rem;
                border-radius: 0.95rem;
                border: 1px solid rgba(255, 255, 255, 0.08);
                background: rgba(255, 255, 255, 0.05);
            }
            .summary-stat.accent {
                background: rgba(229, 9, 20, 0.14);
                border-color: rgba(255, 122, 108, 0.24);
            }
            .summary-stat-value {
                font-size: 1.08rem;
                font-weight: 700;
                letter-spacing: -0.03em;
            }
            .summary-stat-label {
                font-size: 0.74rem;
                color: color-mix(in srgb, white 72%, transparent);
            }
            .session-panel {
                display: grid;
                gap: 0.85rem;
                padding: 1rem;
                border-radius: 1.15rem;
                background: rgba(5, 7, 10, 0.38);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .matchup-actions {
                display: flex;
                gap: 0.65rem;
                justify-content: center;
            }
            .session-secondary {
                display: grid;
                gap: 0.65rem;
            }
            .session-hint {
                margin: 0;
                color: color-mix(in srgb, white 74%, transparent);
                font-size: 0.82rem;
                line-height: 1.45;
            }
            .status-banner {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 0.8rem 0.95rem;
                border-radius: 0.95rem;
                border: 1px solid rgba(255, 255, 255, 0.1);
                background: rgba(10, 13, 18, 0.62);
                color: color-mix(in srgb, white 90%, transparent);
            }
            .status-banner.error {
                background: color-mix(in srgb, var(--pico-del-color) 16%, rgba(255, 255, 255, 0.05));
                border-color: color-mix(in srgb, var(--pico-del-color) 35%, transparent);
            }
            .status-dot {
                width: 0.5rem;
                height: 0.5rem;
                border-radius: 999px;
                background: var(--faceoff-accent);
                box-shadow: 0 0 0 0.25rem rgba(229, 9, 20, 0.18);
                flex: none;
            }
            .session-pill.status.loading .status-dot {
                background: #82d2ff;
            }
            .session-pill.status.idle .status-dot {
                background: #9cc9a7;
            }
            .session-pill.status.error .status-dot {
                display: none;
            }
            .status-banner > span:first-of-type {
                flex: 1;
            }
            .matchup-shell {
                display: block;
            }
            .matchup {
                position: relative;
                display: flex;
                gap: 1.2rem;
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
                width: 3.25rem;
                height: 3.25rem;
                border-radius: 999px;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: rgba(255, 255, 255, 0.88);
                font-size: 0.78rem;
                font-weight: 800;
                letter-spacing: 0.16em;
            }
            .movie-swipe-stage {
                position: relative;
                min-width: 0;
                --swipe-progress: 0;
                padding: 0.15rem 0;
                overflow: hidden;
            }
            .swipe-hint {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                font-size: 0.8rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.08em;
                color: var(--pico-muted-color);
                pointer-events: none;
                opacity: calc(0.08 + var(--swipe-progress) * 0.92);
                transition: opacity 160ms ease;
            }
            .swipe-hint.left {
                justify-content: flex-start;
                padding-left: 0.35rem;
                background: linear-gradient(
                    90deg,
                    color-mix(
                        in srgb,
                        var(--pico-secondary) calc(10% + var(--swipe-progress) * 32%),
                        transparent
                    ),
                    transparent 60%
                );
            }
            .swipe-hint.right {
                justify-content: flex-end;
                padding-right: 0.35rem;
                background: linear-gradient(
                    270deg,
                    color-mix(
                        in srgb,
                        var(--pico-secondary) calc(10% + var(--swipe-progress) * 32%),
                        transparent
                    ),
                    transparent 60%
                );
            }
            .movie-card {
                display: flex;
                flex-direction: column;
                gap: 0.7rem;
                min-height: 100%;
                padding: 0;
                border-radius: 0;
                border: 0;
                background: transparent;
                box-shadow: none;
                transition:
                    transform 180ms ease,
                    box-shadow 180ms ease,
                    border-color 180ms ease,
                    scale 180ms ease;
            }
            .movie-card:hover {
                border-color: transparent;
                box-shadow: none;
                scale: none;
            }
            .movie-title-row {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: start;
                gap: 0.45rem;
            }
            .movie-title-year {
                color: color-mix(in srgb, white 62%, transparent);
                font-size: 0.9rem;
                font-weight: 500;
            }
            .poster-button {
                border: 0;
                background: transparent;
                padding: 0;
                margin: 0;
                cursor: pointer;
                border-radius: 1.2rem;
                overflow: hidden;
                position: relative;
                box-shadow: 0 1.2rem 2.6rem rgba(0, 0, 0, 0.28);
            }
            .poster-button img {
                width: 100%;
                aspect-ratio: 2 / 3;
                object-fit: cover;
                display: block;
                border-radius: 1.2rem;
            }
            .poster-button::after {
                content: '';
                position: absolute;
                inset: 0;
                background:
                    linear-gradient(180deg, transparent 30%, rgba(0, 0, 0, 0.08) 56%, rgba(0, 0, 0, 0.62) 100%);
                pointer-events: none;
            }
            .poster-fallback {
                min-height: 13rem;
                display: grid;
                place-items: center;
                gap: 0.6rem;
                background:
                    radial-gradient(circle at top, rgba(255, 255, 255, 0.08), transparent 48%),
                    rgba(255, 255, 255, 0.08);
                color: color-mix(in srgb, white 72%, transparent);
            }
            .movie-copy h5 {
                margin: 0;
                font-size: clamp(1.15rem, 1rem + 0.55vw, 1.6rem);
                line-height: 1.04;
                letter-spacing: -0.03em;
                min-height: calc(2em * 1.04);
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .movie-actions,
            .rankings-actions {
                display: flex;
                gap: 0.65rem;
                align-items: center;
            }
            .movie-actions {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                align-items: stretch;
            }
            .primary-vote-action,
            .ghost-action {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.45rem;
                margin: 0;
            }
            .primary-vote-action {
                background: color-mix(
                    in srgb,
                    var(--faceoff-accent) 14%,
                    rgba(255, 255, 255, 0.08)
                );
                border: 1px solid rgba(255, 122, 108, 0.32);
                color: white;
                font-weight: 700;
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
            }
            .ghost-action {
                background: rgba(255, 255, 255, 0.07);
                border: 1px solid rgba(255, 255, 255, 0.12);
                color: inherit;
            }
            .wide-action {
                padding-left: 0.85rem;
                padding-right: 0.85rem;
            }
            kbd {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 1.5rem;
                padding: 0.12rem 0.35rem;
                border-radius: 0.4rem;
                border: 1px solid rgba(255, 255, 255, 0.12);
                background: rgba(255, 255, 255, 0.06);
                font: inherit;
                font-size: 0.8em;
                color: white;
            }
            .rankings-header,
            .page-subheader {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .panel-description {
                margin: 0.35rem 0 0;
                color: color-mix(in srgb, white 68%, transparent);
                font-size: 0.9rem;
            }
            .rankings-actions {
                margin-left: auto;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .ranking-select-field {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 0.5rem;
                color: var(--pico-muted-color);
                font-size: 0.83rem;
            }
            .rankings-actions select {
                margin: 0;
                width: 100%;
                min-width: 0;
            }
            .info-button {
                min-width: auto;
            }
            .rank-list {
                margin: 0;
                padding: 0;
                list-style: none;
                display: flex;
                flex-direction: column;
                gap: 0.6rem;
            }
            .rank-row {
                display: grid;
                grid-template-columns: auto 4rem minmax(0, 1fr);
                align-items: center;
                gap: 0.75rem;
                padding: 0.85rem 0.9rem;
                border-radius: 1rem;
                background:
                    linear-gradient(180deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
                    rgba(8, 11, 16, 0.62);
                border: 1px solid rgba(255, 255, 255, 0.07);
            }
            .rank-index {
                width: 2rem;
                height: 2rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                background: rgba(229, 9, 20, 0.16);
                font-weight: 700;
                color: white;
            }
            .rank-poster {
                width: 4rem;
                aspect-ratio: 2 / 3;
                border-radius: 0.75rem;
                overflow: hidden;
                background: rgba(255, 255, 255, 0.06);
                display: block;
            }
            .rank-poster img,
            .rank-poster-fallback {
                width: 100%;
                height: 100%;
                display: block;
            }
            .rank-poster img {
                object-fit: cover;
            }
            .rank-poster-fallback {
                display: grid;
                place-items: center;
                color: color-mix(in srgb, white 62%, transparent);
            }
            .rank-item {
                display: flex;
                justify-content: space-between;
                align-items: start;
                gap: 0.75rem;
                text-align: left;
            }
            .rank-title-group {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 0.16rem;
                min-width: 0;
            }
            .rank-title {
                flex: 1;
                font-weight: 600;
            }
            .rank-subtitle {
                font-size: 0.82rem;
                color: color-mix(in srgb, white 58%, transparent);
            }
            .rank-meta {
                display: inline-flex;
                gap: 0.5rem;
                align-items: center;
                flex-wrap: wrap;
                justify-content: flex-end;
                text-align: right;
            }
            .rank-score {
                font-variant-numeric: tabular-nums;
                font-weight: 700;
                color: color-mix(in srgb, white 92%, var(--faceoff-accent-strong));
            }
            .delete-button {
                margin: 0;
                padding: 0.15rem 0.5rem;
            }
            .excluded-section {
                margin-top: 1.25rem;
            }
            .page-subheader h3 {
                margin: 0;
                font-size: 1rem;
            }
            .excluded-list {
                list-style: none;
                padding: 0;
                margin: 0.75rem 0 0;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .excluded-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 0.75rem;
                padding: 0.7rem 0.8rem;
                border-radius: 0.9rem;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            .excluded-copy {
                display: flex;
                flex-direction: column;
                gap: 0.15rem;
                min-width: 0;
            }
            .excluded-copy strong {
                font-size: 0.95rem;
            }
            .excluded-copy small {
                color: var(--pico-muted-color);
            }
            .error-message {
                color: var(--pico-del-color);
            }
            .algorithm-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 50;
                display: grid;
                place-items: center;
                padding: 1rem;
                background: color-mix(in srgb, black 52%, transparent);
                backdrop-filter: blur(6px);
            }
            .algorithm-modal {
                width: min(34rem, 100%);
                margin: 0;
                max-height: min(80vh, 42rem);
                overflow: auto;
                background: color-mix(in srgb, var(--pico-card-background-color) 84%, #090b10);
                color: white;
            }
            .algorithm-modal-header {
                display: flex;
                align-items: start;
                justify-content: space-between;
                gap: 0.75rem;
            }
            .algorithm-modal-header h3 {
                margin: 0.1rem 0 0;
            }
            .algorithm-modal-eyebrow {
                margin: 0;
                font-size: 0.78rem;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--pico-muted-color);
            }
            .algorithm-modal-body p:last-child {
                margin-bottom: 0;
            }
            .empty-state-panel,
            .placeholder-card {
                display: grid;
                gap: 0.7rem;
                place-items: center;
                text-align: center;
                color: var(--pico-muted-color);
            }
            .placeholder-card {
                min-height: 100%;
                background:
                    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
                    var(--faceoff-surface-strong);
                color: color-mix(in srgb, white 76%, transparent);
            }
            .placeholder-poster {
                width: 100%;
                aspect-ratio: 2 / 3;
                border-radius: 0.95rem;
                display: grid;
                place-items: center;
                background:
                    radial-gradient(circle at top, rgba(255, 255, 255, 0.08), transparent 48%),
                    rgba(255, 255, 255, 0.06);
            }
            .placeholder-copy {
                display: grid;
                gap: 0.35rem;
                width: 100%;
            }
            .placeholder-copy h5,
            .empty-state-panel p {
                margin: 0;
            }
            @media (min-width: 1320px) {
                .layout {
                    grid-template-columns: minmax(0, 1fr) 26rem;
                    width: min(100%, 88rem);
                }
                .rankings-panel {
                    width: 100%;
                    margin-inline: 0;
                }
            }
            @media (max-width: 900px) {
                .pool-toggle {
                    width: 100%;
                }
            }
            @media (max-width: 640px) {
                .faceoff-panel,
                .rankings-panel {
                    padding-left: 0.78rem;
                    padding-right: 0.78rem;
                }
                .rankings-header h2 {
                    font-size: 1.55rem;
                }
                .faceoff-shell {
                    gap: 0.9rem;
                }
                .pool-toggle {
                    width: 100%;
                }
                .pool-toggle button {
                    padding: 0.45rem 0.55rem;
                    font-size: 0.78rem;
                }
                .session-pill {
                    min-height: 2rem;
                    padding: 0.45rem 0.7rem;
                    font-size: 0.78rem;
                }
                .status-action {
                    min-height: 2rem;
                    padding: 0.45rem 0.7rem;
                    font-size: 0.78rem;
                }
                .summary-grid {
                    gap: 0.45rem;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                .summary-stat {
                    gap: 0.1rem;
                    padding: 0.65rem 0.7rem;
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
                    background: rgba(34, 38, 47, 0.92);
                    border-color: rgba(255, 255, 255, 0.16);
                    box-shadow: 0 0.35rem 1rem rgba(0, 0, 0, 0.18);
                }
                .movie-card {
                    gap: 0.45rem;
                }
                .movie-title-row {
                    gap: 0.32rem;
                }
                .movie-card h5 {
                    font-size: 0.98rem;
                    min-height: calc(2em * 1.08);
                    line-height: 1.08;
                }
                .movie-title-year {
                    font-size: 0.8rem;
                }
                .movie-actions button,
                .matchup-actions button,
                .rankings-actions button {
                    font-size: 0.85rem;
                    padding: 0.45rem 0.55rem;
                }
                .rankings-actions {
                    flex-direction: column;
                    align-items: stretch;
                }
                .session-hint {
                    font-size: 0.76rem;
                }
                .movie-actions button {
                    width: 100%;
                    justify-content: center;
                }
                .poster-button {
                    border-radius: 1rem;
                    box-shadow: 0 0.55rem 1.4rem rgba(0, 0, 0, 0.2);
                }
                .poster-button img {
                    border-radius: 1rem;
                }
                .poster-fallback,
                .placeholder-poster {
                    min-height: 8.5rem;
                }
                .swipe-hint {
                    font-size: 0.68rem;
                }
                .algorithm-modal-backdrop {
                    padding: 0.75rem;
                }
                .algorithm-modal {
                    width: 100%;
                }
                .excluded-item {
                    padding: 0.5rem 0.65rem;
                }
                .rank-row {
                    grid-template-columns: auto 3rem minmax(0, 1fr);
                    padding: 0.65rem 0.7rem;
                }
                .rank-poster {
                    width: 3rem;
                }
                .rank-item {
                    flex-direction: column;
                }
                .rank-meta {
                    width: 100%;
                    justify-content: space-between;
                }
                .rankings-actions .ghost-action {
                    width: 100%;
                    justify-content: center;
                }
                .ranking-select-field {
                    width: 100%;
                }
            }
            @media (max-width: 520px) {
                .summary-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
            }
        `,
    ];
}
