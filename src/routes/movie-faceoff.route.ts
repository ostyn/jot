import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation, WebComponentInterface } from '@vaadin/router';
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
import { betterGo } from './route-config';

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

type TargetedInsertionState = {
    targetMovie: FaceoffMovie;
    rankingSortMode: MovieFaceoffSortMode;
    rankedSnapshot: MovieFaceoffRankedMovie[];
    low: number;
    high: number;
    pivotIndex: number;
    pivotMovie: FaceoffMovie | null;
    comparisonsCompleted: number;
    complete: boolean;
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
        this.restoreUndoStack();
        if (this.undoStack.length) {
            this.showUndo = true;
        }
        // Initialize settings from localStorage
        this.useSmartSelection = localStorage.getItem('movieFaceoff_smartSelection') !== 'false';
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
        this.routeInitialized = true;
        const startedFromUrl = await this.maybeStartTargetedInsertionFromUrl();
        if (!startedFromUrl) {
            await this.displayNewPair();
        }
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

        if (this.targetedInsertion) {
            const nextState = this.createTargetedInsertionState(
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
            this.resetSwipeState(0);
            this.resetSwipeState(1);
        }
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

    /**
     * Fast weighted random selection for intelligent movie pairing.
     * Prioritizes under-voted movies while maintaining O(n) complexity.
     */
    private async getSmartMovie(exclude: number[] = [], firstMovie?: FaceoffMovie): Promise<FaceoffMovie | null> {
        const pool = await this.getCandidatePool(exclude);
        if (!pool.length) return null;

        // O(n) weighted random selection - much faster than sorting
        let totalWeight = 0;
        const weights: number[] = [];

        for (const id of pool) {
            const rating = this.replayState.ratings.get(id);
            const totalVotes = (rating?.winCount || 0) + (rating?.lossCount || 0);

            // Simple weight calculation: prioritize low-vote movies
            let weight = Math.max(1, 100 - totalVotes * 2); // 100 for 0 votes, 1 for 50+ votes

            // Bonus for uncertain rankings (Glicko RD)
            const ratingDeviation = rating?.ratingDeviation || 350;
            if (ratingDeviation > 200) weight *= 1.5; // 50% bonus for uncertain movies

            // Pairing bonuses (when selecting second movie)
            if (firstMovie) {
                const firstRating = this.replayState.ratings.get(firstMovie.id);
                const firstTotalVotes = (firstRating?.winCount || 0) + (firstRating?.lossCount || 0);

                // Bonus for vote count diversity
                const voteDiff = Math.abs(totalVotes - firstTotalVotes);
                if (voteDiff > 10) weight *= 1.3; // 30% bonus for different experience levels

                // Small bonus for rating proximity (refine close rankings)
                const firstRatingValue = firstRating?.rating || 1500;
                const candidateRatingValue = rating?.rating || 1500;
                const ratingDiff = Math.abs(firstRatingValue - candidateRatingValue);
                if (ratingDiff < 300) weight *= 1.2; // 20% bonus for close ratings
            }

            weights.push(weight);
            totalWeight += weight;
        }

        // Single-pass weighted random selection
        let random = Math.random() * totalWeight;
        for (let i = 0; i < pool.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                // Try to load this movie, fallback to random if it fails
                try {
                    const movie = await fetchTmdbMovie(pool[i]);
                    await movieFaceoff.upsertMoviesMetadata([movie]);
                    return movie;
                } catch (_error) {
                    // Remove this candidate and try weighted selection again
                    const newPool = pool.filter((_, idx) => idx !== i);
                    return this.getWeightedRandomMovie(newPool, weights.filter((_, idx) => idx !== i));
                }
            }
        }

        // Fallback to simple random selection
        return this.getRandomMovie(exclude);
    }

    /**
     * Helper method for weighted random selection when a candidate fails to load
     */
    private async getWeightedRandomMovie(pool: number[], weights: number[]): Promise<FaceoffMovie | null> {
        const totalWeight = weights.reduce((sum, w) => sum + w, 0);
        let random = Math.random() * totalWeight;

        for (let i = 0; i < pool.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                try {
                    const movie = await fetchTmdbMovie(pool[i]);
                    await movieFaceoff.upsertMoviesMetadata([movie]);
                    return movie;
                } catch (_error) {
                    continue; // Skip this one and continue
                }
            }
        }

        return null;
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

    private toFaceoffMovie(
        movie: Pick<MovieFaceoffMovie, 'id' | 'title' | 'posterPath' | 'releaseDate'>
    ): FaceoffMovie {
        return {
            id: movie.id,
            title: movie.title,
            poster_path: movie.posterPath,
            release_date: movie.releaseDate,
        };
    }

    private createTargetedInsertionState(
        targetMovie: FaceoffMovie,
        comparisonsCompleted = 0,
        low = 0,
        high?: number
    ): TargetedInsertionState {
        const rankedSnapshot = this.visibleRankedMovies.filter(
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
                rankingSortMode: this.sortMode,
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
        const pivotMovie = this.toFaceoffMovie(rankedSnapshot[pivotIndex]);

        return {
            targetMovie,
            rankingSortMode: this.sortMode,
            rankedSnapshot,
            low: normalizedLow,
            high: normalizedHigh,
            pivotIndex,
            pivotMovie,
            comparisonsCompleted,
            complete: false,
        };
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

        const nextState = this.createTargetedInsertionState(
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
            this.resetSwipeState(0);
            this.resetSwipeState(1);
        }
    }

    private async startTargetedInsertion(movie: FaceoffMovie) {
        this.sortMode = 'manual';
        await movieFaceoff.upsertMoviesMetadata([movie]);

        const nextState = this.createTargetedInsertionState(movie);
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
        this.resetSwipeState(0);
        this.resetSwipeState(1);
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
            const left = await (useSmart ? this.getSmartMovie() : this.getRandomMovie());
            if (!left) {
                this.movies = [null, null];
                this.errorMessage = this.useRankedOnly
                    ? 'Rank at least two movies before using ranked-only mode.'
                    : 'No movies are available right now.';
                return;
            }

            const right = await (useSmart ? this.getSmartMovie([left.id], left) : this.getRandomMovie([left.id]));
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
        if (this.targetedInsertion) {
            this.errorMessage = 'Targeted placement only supports choosing between the target and comparison movie.';
            return;
        }
        const existingMovies = this.movies.filter(Boolean) as FaceoffMovie[];
        const exclude = existingMovies.map((movie) => movie.id);
        const otherMovie = existingMovies.find(movie => movie.id !== this.movies[index]?.id);
        // Only use smart selection in "My movies" mode with smart pairing enabled
        const useSmart = this.useRankedOnly && this.useSmartSelection;
        const replacement = await (useSmart ? this.getSmartMovie(exclude, otherMovie) : this.getRandomMovie(exclude));
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
            const session = this.targetedInsertion;
            const pivotIndex = session.pivotIndex;
            const nextHigh = winnerIndex === 0 ? pivotIndex : session.high;
            const nextLow =
                winnerIndex === 1 ? Math.min(session.high, pivotIndex + 1) : session.low;

            await this.refreshTargetedInsertion({
                comparisonsCompleted: session.comparisonsCompleted + 1,
                low: nextLow,
                high: nextHigh,
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
        this.resetSwipeState(0);
        this.resetSwipeState(1);

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

    private getMovieYear(movie: Pick<FaceoffMovie, 'release_date'>) {
        return movie.release_date?.split('-')[0] || 'Unknown year';
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
        const year = this.getMovieYear(movie);
        const isTargetedCard = this.targetedInsertion?.targetMovie.id === movie.id;

        return html`
            <div
                class="movie-swipe-stage ${this.swipeIntent[index] ? 'skip' : ''} ${this.targetedInsertion ? 'targeted' : ''}"
                data-index=${index}
                style=${`--swipe-progress:${swipeProgress};`}
            >
                <div class="swipe-hint ${index === 0 ? 'left' : 'right'}" aria-hidden="true">
                    Not seen
                </div>
                <article
                    class="movie-card ${isTargetedCard ? 'target-card' : ''}"
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
                                ${this.targetedInsertion
                                    ? html`<small class="targeted-card-label">
                                          ${isTargetedCard
                                              ? 'Target movie'
                                              : `Compare against #${
                                                    this.targetedInsertion.pivotIndex + 1
                                                }`}
                                      </small>`
                                    : nothing}
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
                                  <small class="selection-description">Intelligently selects movies to improve rankings</small>
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
                                        ?disabled=${this.isTargetedMode}
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
                                <div role="group">
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
                                                          <button
                                                              class="outline"
                                                              @click=${() =>
                                                                  betterGo(
                                                                      'movie-faceoff-movie',
                                                                      {
                                                                          pathParams: {
                                                                              id: movie.id,
                                                                          },
                                                                      }
                                                                  )}
                                                          >
                                                              Details
                                                          </button>
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
            .faceoff-panel > *,
            .rankings-panel > * {
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
            .selection-description {
                color: var(--pico-muted-color);
                font-size: 0.875rem;
                margin: 0;
                white-space: nowrap;
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
                box-shadow: none;
                padding: 0;
                display: flex;
                flex-direction: column;
                gap: 0.85rem;
                min-height: 100%;
                margin: 0;
                transition:
                    transform 180ms ease,
                    box-shadow 180ms ease;
            }
            .movie-card.target-card {
                border-color: color-mix(
                    in srgb,
                    var(--pico-primary-border) 72%,
                    var(--pico-card-border-color)
                );
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
            .targeted-card-label {
                display: inline-flex;
                margin-top: 0.5rem;
                font-size: 0.82rem;
            }
            .movie-actions {
                margin-top: auto;
                margin-bottom: auto;
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
