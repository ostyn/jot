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
            this.statusMessage = 'Undo available';
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

    private snapshotCurrentPair() {
        return clonePair(this.movies);
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
                              @click=${() => {
                                  void this.vote(index);
                              }}
                          >
                              <img src=${imageUrl} alt=${movie.title} />
                          </button>`
                        : html`<button
                              class="poster-button poster-fallback"
                              @click=${() => {
                                  void this.vote(index);
                              }}
                          >
                              <span>No poster</span>
                          </button>`}
                    <hgroup>
                        <h5>${movie.title}</h5>
                        <p>${movie.release_date?.split('-')[0] || 'Unknown year'}</p>
                    </hgroup>
                    <div class="movie-actions">
                        <button
                            class="secondary"
                            @click=${() => {
                                void this.markMovieUnseen(index);
                            }}
                        >
                            Not Seen
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

        return html`
            <utility-page-header title="Movie Faceoff"></utility-page-header>
            <section class="layout">
                <article class="faceoff-panel">
                    <header>
                        <h2>Pick a winner</h2>
                        <p>
                            Arrow keys vote left/right. Use Shift + arrows to mark
                            one movie as not seen, or Arrow Down for both. On touch,
                            swipe a card outward for “not seen”.
                        </p>
                    </header>

                    <label class="ranked-toggle">
                        <input
                            type="checkbox"
                            .checked=${this.useRankedOnly}
                            @change=${async (event: Event) => {
                                this.useRankedOnly = (
                                    event.currentTarget as HTMLInputElement
                                ).checked;
                                await this.displayNewPair();
                            }}
                        />
                        Only rank known movies
                    </label>

                    ${this.errorMessage
                        ? html`<p class="error-message">${this.errorMessage}</p>`
                        : nothing}

                    <div class="matchup">
                        ${left
                            ? this.renderMovie(left, 0)
                            : html`<article class="movie-card placeholder">
                                  <p>${this.isLoading ? 'Loading...' : 'No movie loaded'}</p>
                              </article>`}
                        ${right
                            ? this.renderMovie(right, 1)
                            : html`<article class="movie-card placeholder">
                                  <p>${this.isLoading ? 'Loading...' : 'No movie loaded'}</p>
                              </article>`}
                    </div>

                    <div class="controls">
                        <button
                            class="secondary"
                            @click=${() => {
                                void this.markBothMoviesUnseen();
                            }}
                        >
                            Mark Both Not Seen
                        </button>
                    </div>

                    ${this.statusMessage
                        ? html`<div class="status-note" role="status">
                              <span>${this.statusMessage}</span>
                              ${this.showUndo
                                  ? html`<button
                                        class="inline subtle-action"
                                        @click=${() => void this.undoLastAction()}
                                    >
                                        Undo
                                    </button>`
                                  : nothing}
                          </div>`
                        : nothing}
                </article>

                <article class="rankings-panel">
                    <header class="rankings-header">
                        <h2>Rankings</h2>
                        <div class="rankings-actions">
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
                            <button
                                class="secondary info-button"
                                title="About the current ranking method"
                                aria-label="About the current ranking method"
                                @click=${() => {
                                    this.showAlgorithmInfo = true;
                                }}
                            >
                                i
                            </button>
                            <button
                                class="secondary"
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
                                  (movie) => html`
                                      <li>
                                          <span class="rank-item">
                                              <span class="rank-title">${movie.title}</span>
                                              <span class="rank-meta">
                                                  <span>${this.renderRankValue(movie)}</span>
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
                                  `
                              )}
                          </ol>`
                        : html`<p class="empty-state">
                              Your rankings will appear here after a few faceoffs.
                          </p>`}

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
                                                  <span>${movie.title}</span>
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
                              <section class="excluded-section">
                                  <header class="page-subheader">
                                      <h3>Not Seen</h3>
                                      <small>${this.unseenMovies.length}</small>
                                  </header>
                                  <ul class="excluded-list">
                                      ${this.unseenMovies.map(
                                          (movie) => html`
                                              <li class="excluded-item">
                                                  <span>${movie.title}</span>
                                                  <button
                                                      class="secondary"
                                                      @click=${() =>
                                                          void this.restoreSeenMovie(
                                                              movie
                                                          )}
                                                  >
                                                      Mark Seen
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
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .layout {
                display: grid;
                gap: 1rem;
                grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
                align-items: start;
            }
            .faceoff-panel,
            .rankings-panel {
                margin: 0;
            }
            .ranked-toggle {
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                margin-bottom: 1rem;
            }
            .matchup {
                display: grid;
                gap: 1rem;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                align-items: start;
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
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
                gap: 0.75rem;
                min-height: 100%;
                transition: transform 180ms ease;
            }
            .poster-button {
                border: 0;
                background: transparent;
                padding: 0;
                margin: 0;
                cursor: pointer;
                border-radius: 0.75rem;
                overflow: hidden;
            }
            .poster-button img {
                width: 100%;
                aspect-ratio: 2 / 3;
                object-fit: cover;
                display: block;
                border-radius: 0.75rem;
            }
            .poster-fallback {
                min-height: 12rem;
                display: grid;
                place-items: center;
                background: var(--pico-muted-border-color);
                color: var(--pico-muted-color);
            }
            .movie-actions,
            .controls,
            .rankings-actions {
                display: flex;
                gap: 0.5rem;
                align-items: center;
            }
            .controls {
                justify-content: center;
                margin-top: 1rem;
            }
            .status-note {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
                margin: 0.625rem 0 0;
                padding: 0 0.25rem;
                color: var(--pico-muted-color);
                font-size: 0.9rem;
            }
            .subtle-action {
                padding: 0;
                border: 0;
                background: transparent;
                color: var(--pico-primary);
                text-decoration: underline;
                margin-bottom: 0;
                white-space: nowrap;
            }
            .rankings-header,
            .page-subheader {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .rankings-actions {
                margin-left: auto;
            }
            .rankings-actions select {
                margin: 0;
                width: auto;
            }
            .info-button {
                margin: 0;
                min-width: 2.35rem;
                padding-left: 0.65rem;
                padding-right: 0.65rem;
                font-weight: 700;
            }
            .rank-list {
                margin: 0;
                padding-left: 1.25rem;
            }
            .rank-item {
                display: flex;
                justify-content: space-between;
                align-items: start;
                gap: 0.75rem;
                text-align: left;
            }
            .rank-title {
                flex: 1;
            }
            .rank-meta {
                display: inline-flex;
                gap: 0.5rem;
                align-items: center;
                flex-wrap: wrap;
                justify-content: flex-end;
                text-align: right;
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
                padding: 0.625rem 0.75rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
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
            .empty-state,
            .placeholder {
                color: var(--pico-muted-color);
            }
            @media (max-width: 900px) {
                .layout {
                    grid-template-columns: 1fr;
                }
            }
            @media (max-width: 640px) {
                .faceoff-panel,
                .rankings-panel {
                    padding-left: 0.7rem;
                    padding-right: 0.7rem;
                }
                .matchup {
                    gap: 0.55rem;
                }
                .movie-card {
                    gap: 0.4rem;
                    padding: 0.65rem;
                }
                .movie-card h5 {
                    font-size: 0.92rem;
                    margin-bottom: 0.15rem;
                }
                .movie-card p {
                    font-size: 0.8rem;
                    margin-bottom: 0;
                }
                .movie-actions button,
                .controls button {
                    font-size: 0.85rem;
                    padding: 0.45rem 0.55rem;
                }
                .poster-fallback {
                    min-height: 9.5rem;
                }
                .swipe-hint {
                    font-size: 0.68rem;
                }
                .status-note {
                    padding: 0;
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
            }
        `,
    ];
}
