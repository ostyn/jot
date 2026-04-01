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
            <article class="summary-stat ${accent ? 'accent' : ''}">
                <p>${label}</p>
                <strong>${value}</strong>
            </article>
        `;
    }

    private renderMoviePlaceholder(index: 0 | 1) {
        const label =
            index === 0 ? 'First movie placeholder' : 'Second movie placeholder';
        const message = this.isLoading ? 'Loading a fresh movie...' : 'No movie loaded';

        return html`
            <article class="movie-card placeholder-card" aria-label=${label}>
                <div class="movie-poster placeholder-poster">
                    <jot-icon name="Play" size="large"></jot-icon>
                </div>
                <div class="movie-copy placeholder-copy">
                    <h3>${message}</h3>
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
                <div class="swipe-hint ${index === 0 ? 'left' : 'right'}" aria-hidden="true">
                    Not seen
                </div>
                <article
                    class="movie-card"
                    style=${`transform: translateX(${this.swipeOffsets[index]}px) rotate(${this.swipeOffsets[index] * 0.04}deg);`}
                >
                    ${imageUrl
                        ? html`<button
                              class="poster-button movie-poster"
                              aria-label=${`Pick ${movie.title}`}
                              @click=${() => {
                                  void this.vote(index);
                              }}
                          >
                              <img src=${imageUrl} alt=${movie.title} />
                          </button>`
                        : html`<button
                              class="poster-button poster-fallback movie-poster"
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
                            <div>
                                <h3 title=${movie.title}>${movie.title}</h3>
                                <p>${year}</p>
                            </div>
                        </div>
                    </div>
                    <footer class="movie-actions">
                        <button
                            class="secondary"
                            @click=${() => {
                                void this.markMovieUnseen(index);
                            }}
                        >
                            <jot-icon name="EyeOff"></jot-icon>
                            Not seen
                        </button>
                        <button
                            @click=${() => {
                                void this.vote(index);
                            }}
                        >
                            Choose
                        </button>
                    </footer>
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
                    <header>
                        <div>
                            <p class="eyebrow">Current ranking method</p>
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
                    <div>
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
            <main class="layout">
                <section class="faceoff-column">
                    <article class="faceoff-panel surface-panel">
                        <header class="panel-header">
                            <div>
                                <p class="eyebrow">Choose the better movie</p>
                                <h2>Current faceoff</h2>
                            </div>
                            <div role="group" class="pool-toggle" aria-label="Movie pool">
                                <button
                                    class=${this.useRankedOnly ? 'secondary' : ''}
                                    aria-pressed=${!this.useRankedOnly}
                                    @click=${() => {
                                        void this.setPoolMode(false);
                                    }}
                                >
                                    All movies
                                </button>
                                <button
                                    class=${this.useRankedOnly ? '' : 'secondary'}
                                    aria-pressed=${this.useRankedOnly}
                                    @click=${() => {
                                        void this.setPoolMode(true);
                                    }}
                                >
                                    My movies
                                </button>
                            </div>
                        </header>

                        <div class="poster-wash" aria-hidden="true">
                            <div
                                class="poster-wash-panel ${leftPoster ? 'has-image' : ''}"
                                style=${leftPoster ? `background-image:url(${leftPoster});` : ''}
                            ></div>
                            <div
                                class="poster-wash-panel ${rightPoster ? 'has-image' : ''}"
                                style=${rightPoster ? `background-image:url(${rightPoster});` : ''}
                            ></div>
                        </div>

                        ${this.errorMessage
                            ? html`<aside class="status-banner error" role="alert">
                                  <jot-icon name="AlertTriangle"></jot-icon>
                                  <span>${this.errorMessage}</span>
                              </aside>`
                            : nothing}

                        <section class="matchup-shell" aria-label="Current matchup">
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
                        </section>

                        <footer class="session-panel">
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

                            <div class="matchup-actions" role="group" aria-label="Current matchup actions">
                                <button
                                    class="secondary"
                                    @click=${() => {
                                        void this.markBothMoviesUnseen();
                                    }}
                                >
                                    <jot-icon name="EyeOff"></jot-icon>
                                    Mark both unseen
                                </button>
                            </div>

                            <p class="session-hint">
                                Swipe outward for not seen. Keyboard shortcuts:
                                <kbd>Shift</kbd> + <kbd>Arrow</kbd> marks one movie unseen,
                                <kbd>Down</kbd> marks both.
                            </p>
                        </footer>
                    </article>
                </section>

                <aside class="rankings-column">
                    <article class="rankings-panel surface-panel">
                        <header class="panel-header rankings-header">
                            <div class="rankings-heading">
                                <p class="eyebrow">Live leaderboard</p>
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
                                    class="secondary"
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
                                    class=${this.editList ? '' : 'secondary'}
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
                                                  <strong class="rank-index"
                                                      >${index + 1}</strong
                                                  >
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
                                                          <strong class="rank-title"
                                                              >${movie.title}</strong
                                                          >
                                                          <small class="rank-subtitle"
                                                              >${movie.releaseDate?.split('-')[0] ||
                                                              'Unknown year'}</small
                                                          >
                                                      </span>
                                                      <span class="rank-meta">
                                                          <strong class="rank-score"
                                                              >${this.renderRankValue(movie)}</strong
                                                          >
                                                          ${this.editList
                                                              ? html`<button
                                                                    class="outline delete-button"
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
                            : html`<article class="empty-state-panel">
                                  <jot-icon name="TrendingUp" size="large"></jot-icon>
                                  <p>Your rankings will appear here after a few faceoffs.</p>
                              </article>`}

                        ${this.editList && this.excludedMovies.length
                            ? html`
                                  <section class="list-section">
                                      <header class="list-section-header">
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
                                                          class="secondary"
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
                                  <section class="list-section">
                                      <header class="list-section-header">
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
                                                          class="secondary"
                                                          @click=${() =>
                                                              void this.restoreSeenMovie(movie)}
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
                </aside>
            </main>
            ${this.renderAlgorithmInfoModal()}
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
            .movie-copy,
            .rank-item,
            .rank-title-group,
            .rankings-actions,
            .ranking-select-field,
            .feedback-bar > * {
                min-width: 0;
            }
            .surface-panel {
                position: relative;
                overflow: hidden;
                margin: 0;
            }
            .faceoff-panel {
                display: grid;
                gap: 1rem;
            }
            .panel-header,
            .rankings-header,
            .list-section-header {
                position: relative;
                z-index: 1;
                display: flex;
                justify-content: space-between;
                align-items: start;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .panel-header h2,
            .rankings-header h2,
            .list-section-header h3,
            .movie-copy h3 {
                margin: 0;
            }
            .eyebrow {
                margin: 0 0 0.2rem;
                color: var(--pico-muted-color);
                font-size: 0.78rem;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }
            .poster-wash {
                position: absolute;
                inset: 0;
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                opacity: 0.18;
                pointer-events: none;
            }
            .poster-wash-panel {
                background:
                    linear-gradient(180deg, transparent, var(--pico-card-background-color)),
                    var(--pico-muted-border-color);
                background-size: cover;
                background-position: center;
                filter: blur(24px);
                transform: scale(1.06);
            }
            .poster-wash-panel.has-image {
                background-blend-mode: multiply;
            }
            .faceoff-panel > *,
            .rankings-panel > * {
                position: relative;
                z-index: 1;
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
            .panel-description,
            .session-hint,
            .placeholder-copy p,
            .empty-state-panel p,
            .rank-subtitle,
            .excluded-copy small {
                margin: 0;
                color: var(--pico-muted-color);
            }
            .summary-stat strong {
                font-size: 1.1rem;
            }
            .session-panel {
                display: grid;
                gap: 1rem;
                padding: 0;
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
            .movie-swipe-stage {
                position: relative;
                min-width: 0;
                --swipe-progress: 0;
                padding: 0.25rem 0;
                overflow: hidden;
            }
            .swipe-hint {
                position: absolute;
                inset: 0;
                display: flex;
                align-items: center;
                font-size: 0.75rem;
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
                padding-left: 0.5rem;
                background: linear-gradient(
                    90deg,
                    color-mix(
                        in srgb,
                        var(--pico-primary) calc(10% + var(--swipe-progress) * 32%),
                        transparent
                    ),
                    transparent 60%
                );
            }
            .swipe-hint.right {
                justify-content: flex-end;
                padding-right: 0.5rem;
                background: linear-gradient(
                    270deg,
                    color-mix(
                        in srgb,
                        var(--pico-primary) calc(10% + var(--swipe-progress) * 32%),
                        transparent
                    ),
                    transparent 60%
                );
            }
            .movie-card {
                display: flex;
                flex-direction: column;
                gap: 0.85rem;
                min-height: 100%;
                margin: 0;
                transition:
                    transform 180ms ease,
                    box-shadow 180ms ease;
            }
            .movie-title-row {
                min-width: 0;
            }
            .poster-button {
                padding: 0;
                cursor: pointer;
                overflow: hidden;
                position: relative;
            }
            .movie-poster {
                aspect-ratio: 2 / 3;
                border-radius: var(--pico-border-radius);
                overflow: hidden;
                background: var(--pico-card-sectioning-background-color);
            }
            .poster-button img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            .poster-button::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(180deg, transparent 25%, rgba(0, 0, 0, 0.25) 100%);
                pointer-events: none;
            }
            .poster-fallback {
                display: grid;
                place-items: center;
                gap: 0.6rem;
                text-align: center;
            }
            .movie-copy h3 {
                font-size: clamp(1.1rem, 1rem + 0.55vw, 1.5rem);
                line-height: 1.1;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .movie-copy p {
                margin-top: 0.35rem;
            }
            .movie-actions {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 0.75rem;
                margin-top: auto;
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
            .rankings-actions {
                display: flex;
                gap: 0.75rem;
                align-items: end;
                margin-left: auto;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .ranking-select-field {
                display: flex;
                flex-direction: column;
                align-items: flex-start;
                gap: 0.35rem;
                font-size: 0.9rem;
            }
            .rankings-actions select {
                margin: 0;
                width: 100%;
                min-width: 12rem;
            }
            .rank-list {
                margin: 0;
                padding: 0;
                list-style: none;
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            .rank-row {
                display: grid;
                grid-template-columns: auto 4rem minmax(0, 1fr);
                align-items: center;
                gap: 0.75rem;
                padding: 0.85rem 1rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .rank-index {
                width: 2rem;
                height: 2rem;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                border-radius: 999px;
                background: var(--pico-primary-background);
                color: var(--pico-primary-inverse);
            }
            .rank-poster {
                width: 4rem;
                aspect-ratio: 2 / 3;
                border-radius: calc(var(--pico-border-radius) * 0.8);
                overflow: hidden;
                background: var(--pico-form-element-background-color);
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
            }
            .delete-button {
                margin-bottom: 0;
            }
            .list-section {
                margin-top: 1.25rem;
            }
            .excluded-list {
                margin: 0.75rem 0 0;
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            .excluded-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 0.75rem;
                padding: 0.75rem 1rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .excluded-copy {
                display: flex;
                flex-direction: column;
                gap: 0.15rem;
                min-width: 0;
            }
            .algorithm-modal-backdrop {
                position: fixed;
                inset: 0;
                z-index: 50;
                display: grid;
                place-items: center;
                padding: 1rem;
                background: color-mix(in srgb, black 55%, transparent);
            }
            .algorithm-modal {
                width: min(34rem, 100%);
                margin: 0;
                max-height: min(80vh, 42rem);
                overflow: auto;
            }
            .algorithm-modal > header {
                display: flex;
                align-items: start;
                justify-content: space-between;
                gap: 0.75rem;
            }
            .empty-state-panel,
            .placeholder-card {
                display: grid;
                gap: 0.85rem;
                place-items: center;
                text-align: center;
                margin: 0;
            }
            .placeholder-card {
                min-height: 100%;
            }
            .placeholder-poster {
                display: grid;
                place-items: center;
            }
            .placeholder-copy {
                display: grid;
                gap: 0.35rem;
                width: 100%;
            }
            .placeholder-copy h3 {
                margin: 0;
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
                .rankings-actions {
                    flex-direction: column;
                    align-items: stretch;
                }
                .movie-actions button {
                    width: 100%;
                    justify-content: center;
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
                .rankings-actions button,
                .ranking-select-field,
                .ranking-select-field select,
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
