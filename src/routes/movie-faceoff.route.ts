import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';
import '../components/utility-page-header.component';
import {
    FaceoffMovie,
    fetchMovieFaceoffIds,
    fetchTmdbMovie,
    getMoviePosterUrl,
} from '../services/movie-faceoff.service';

type MovieRating = {
    id: string;
    title: string;
    rating: number;
    winCount: number;
    lossCount: number;
};

type BeatMap = Record<string, Set<string>>;
type SortMode =
    | 'elo'
    | 'wins'
    | 'transitive'
    | 'manual'
    | 'copeland'
    | 'markov'
    | 'bradley-terry';

type RankedMovie = MovieRating & { score?: number };

const RATINGS_KEY = 'ratings';
const BEAT_MAP_KEY = 'beatMap';
const MANUAL_LIST_KEY = 'manualList';

@customElement('movie-faceoff-route')
export class MovieFaceoffRoute extends MobxLitElement {
    @state()
    private movies: Array<FaceoffMovie | null> = [null, null];

    @state()
    private ratings: Record<string, MovieRating> =
        JSON.parse(localStorage.getItem(RATINGS_KEY) || '{}') || {};

    @state()
    private manualList: string[] =
        JSON.parse(localStorage.getItem(MANUAL_LIST_KEY) || '[]') || [];

    @state()
    private sortMode: SortMode = 'elo';

    @state()
    private useRankedOnly = false;

    @state()
    private editList = false;

    @state()
    private isLoading = false;

    @state()
    private errorMessage = '';

    @state()
    private swipeOffsets: [number, number] = [0, 0];

    @state()
    private swipeIntent: ['' | 'skip', '' | 'skip'] = ['', ''];

    private beatMap: BeatMap = this.readBeatMap();
    private movieIdPool: number[] | null = null;
    private gestureHosts: Array<HTMLElement | undefined> = [];
    private gestures: Array<TinyGesture<HTMLElement> | undefined> = [];
    private swipeActionTimers: Array<number | undefined> = [];
    private swipeSettling: [boolean, boolean] = [false, false];
    private readonly keyDownHandler = (event: KeyboardEvent) =>
        this.handleKeyDown(event);

    connectedCallback() {
        super.connectedCallback();
        void this.displayNewPair();
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

    private readBeatMap(): BeatMap {
        const rawBeatMap = JSON.parse(localStorage.getItem(BEAT_MAP_KEY) || '{}') || {};
        return Object.fromEntries(
            Object.entries(rawBeatMap).map(([key, value]) => [
                key,
                new Set((value as string[]) || []),
            ])
        );
    }

    private persistState() {
        localStorage.setItem(RATINGS_KEY, JSON.stringify(this.ratings));
        localStorage.setItem(
            BEAT_MAP_KEY,
            JSON.stringify(
                Object.fromEntries(
                    Object.entries(this.beatMap).map(([key, value]) => [
                        key,
                        Array.from(value),
                    ])
                )
            )
        );
        localStorage.setItem(MANUAL_LIST_KEY, JSON.stringify(this.manualList));
    }

    private async ensureMovieIdPool() {
        if (this.movieIdPool) return this.movieIdPool;
        this.movieIdPool = await fetchMovieFaceoffIds();
        return this.movieIdPool;
    }

    private async getRandomMovie(exclude: number[] = []): Promise<FaceoffMovie | null> {
        const pool = this.useRankedOnly
            ? Object.keys(this.ratings)
                  .map((id) => Number(id))
                  .filter((id) => !exclude.includes(id))
            : (await this.ensureMovieIdPool()).filter((id) => !exclude.includes(id));

        if (!pool.length) return null;

        const id = pool[Math.floor(Math.random() * pool.length)];
        return fetchTmdbMovie(id);
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
        } catch (error) {
            this.movies = [null, null];
            this.errorMessage =
                error instanceof Error ? error.message : 'Unable to load movies.';
        } finally {
            this.isLoading = false;
        }
    }

    private async skip(index: 0 | 1) {
        this.resetSwipeState(index);
        const existingMovies = this.movies.filter(Boolean) as FaceoffMovie[];
        const exclude = existingMovies.map((movie) => movie.id);
        try {
            const replacement = await this.getRandomMovie(exclude);
            if (!replacement) {
                this.errorMessage = 'No replacement movie is available.';
                return;
            }
            this.movies =
                index === 0
                    ? [replacement, this.movies[1]]
                    : [this.movies[0], replacement];
        } catch (error) {
            this.errorMessage =
                error instanceof Error ? error.message : 'Unable to load next movie.';
        }
    }

    private async skipBoth() {
        this.resetSwipeState(0);
        this.resetSwipeState(1);
        await this.displayNewPair();
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
        const [left, right] = this.movies;
        if (!left || !right) return;

        if (event.shiftKey && event.key === 'ArrowLeft') {
            event.preventDefault();
            void this.skip(0);
            return;
        }

        if (event.shiftKey && event.key === 'ArrowRight') {
            event.preventDefault();
            void this.skip(1);
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            void this.skipBoth();
            return;
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            void this.vote(left, right);
            return;
        }

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            void this.vote(right, left);
        }
    }

    private getOrCreateRating(movie: FaceoffMovie) {
        const id = String(movie.id);
        if (!this.ratings[id]) {
            this.ratings = {
                ...this.ratings,
                [id]: {
                    id,
                    title: movie.title,
                    rating: 1500,
                    winCount: 0,
                    lossCount: 0,
                },
            };
        }
        return this.ratings[id];
    }

    private async vote(winner: FaceoffMovie, loser: FaceoffMovie) {
        const K = 32;
        const winnerId = String(winner.id);
        const loserId = String(loser.id);

        const winnerRating = { ...this.getOrCreateRating(winner) };
        const loserRating = { ...this.getOrCreateRating(loser) };

        const expectedWinner =
            1 / (1 + 10 ** ((loserRating.rating - winnerRating.rating) / 400));
        const expectedLoser = 1 - expectedWinner;

        winnerRating.rating += K * (1 - expectedWinner);
        loserRating.rating += K * (0 - expectedLoser);
        winnerRating.winCount++;
        loserRating.lossCount++;

        this.ratings = {
            ...this.ratings,
            [winnerId]: winnerRating,
            [loserId]: loserRating,
        };

        if (!this.beatMap[winnerId]) this.beatMap[winnerId] = new Set();
        this.beatMap[winnerId].add(loserId);

        this.insertManual(winner, loser);
        this.persistState();
        await this.displayNewPair();
    }

    private insertManual(winner: FaceoffMovie, loser: FaceoffMovie) {
        const winnerId = String(winner.id);
        const loserId = String(loser.id);
        const list = [...this.manualList];
        const winnerIndex = list.indexOf(winnerId);
        const loserIndex = list.indexOf(loserId);

        if (winnerIndex !== -1 && loserIndex !== -1 && winnerIndex < loserIndex) {
            this.manualList = [...new Set(list)];
            return;
        }

        if (winnerIndex !== -1 && loserIndex !== -1 && winnerIndex > loserIndex) {
            list.splice(winnerIndex, 1);
            const newLoserIndex = list.indexOf(loserId);
            list.splice(newLoserIndex, 0, winnerId);
        }

        if (winnerIndex === -1 && loserIndex !== -1) {
            list.splice(list.indexOf(loserId), 0, winnerId);
        }

        if (winnerIndex !== -1 && loserIndex === -1) {
            list.push(loserId);
        }

        if (winnerIndex === -1 && loserIndex === -1) {
            list.push(winnerId, loserId);
        }

        this.manualList = [...new Set(list)];
    }

    private computeTransitiveScores(): RankedMovie[] {
        const scores: Record<string, number> = {};
        const visitedCache: Record<string, number> = {};

        const dfs = (id: string, visited = new Set<string>()) => {
            if (visitedCache[id] !== undefined) return visitedCache[id];
            if (!this.beatMap[id]) return 0;
            visited.add(id);
            let count = 0;
            for (const defeated of this.beatMap[id]) {
                if (!visited.has(defeated)) {
                    count += 1 + dfs(defeated, visited);
                }
            }
            visitedCache[id] = count;
            return count;
        };

        for (const id in this.ratings) {
            scores[id] = dfs(id, new Set<string>());
        }

        return Object.entries(scores)
            .map(([id, score]) => ({ ...this.ratings[id], score }))
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    private computeCopelandScores(): RankedMovie[] {
        const ids = Object.keys(this.ratings);
        const scores: Record<string, RankedMovie> = {};

        for (const id of ids) {
            let wins = 0;
            let losses = 0;

            for (const otherId of ids) {
                if (id === otherId) continue;
                const beat = this.beatMap[id]?.has(otherId);
                const lost = this.beatMap[otherId]?.has(id);
                if (beat) wins++;
                if (lost) losses++;
            }

            scores[id] = {
                ...this.ratings[id],
                score: wins - losses,
            };
        }

        return Object.values(scores).sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    private computeMarkovScores(iterations = 50, damping = 0.85): RankedMovie[] {
        const ids = Object.keys(this.ratings);
        const count = ids.length;
        if (!count) return [];

        const reverseEdges: Record<string, Set<string>> = {};
        ids.forEach((id) => (reverseEdges[id] = new Set()));

        for (const [winner, losers] of Object.entries(this.beatMap)) {
            for (const loser of losers) {
                if (!reverseEdges[loser]) reverseEdges[loser] = new Set();
                reverseEdges[loser].add(winner);
            }
        }

        const index = Object.fromEntries(ids.map((id, i) => [id, i]));
        const matrix = Array.from({ length: count }, () =>
            new Array<number>(count).fill(0)
        );

        for (let i = 0; i < count; i++) {
            const fromId = ids[i];
            const toSet = reverseEdges[fromId];
            if (!toSet?.size) continue;

            const share = 1 / toSet.size;
            for (const toId of toSet) {
                const j = index[toId];
                if (j !== undefined) matrix[i][j] = share;
            }
        }

        const rank = new Array<number>(count).fill(1 / count);
        const temp = new Array<number>(count).fill(0);

        for (let iteration = 0; iteration < iterations; iteration++) {
            for (let j = 0; j < count; j++) {
                temp[j] = (1 - damping) / count;
            }

            for (let i = 0; i < count; i++) {
                for (let j = 0; j < count; j++) {
                    temp[j] += damping * rank[i] * matrix[i][j];
                }
            }

            rank.splice(0, count, ...temp);
        }

        return ids
            .map((id, i) => ({
                ...this.ratings[id],
                score: rank[i],
            }))
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    private computeBradleyTerryScores(
        iterations = 100,
        learningRate = 0.01
    ): RankedMovie[] {
        const ids = Object.keys(this.ratings);
        if (!ids.length) return [];

        const strengths: Record<string, number> = {};
        ids.forEach((id) => (strengths[id] = 0));

        const outcomes: Array<[string, string]> = [];
        for (const [winner, losers] of Object.entries(this.beatMap)) {
            for (const loser of losers) {
                outcomes.push([winner, loser]);
            }
        }

        for (let iteration = 0; iteration < iterations; iteration++) {
            for (const [winner, loser] of outcomes) {
                const winnerStrength = Math.exp(strengths[winner]);
                const loserStrength = Math.exp(strengths[loser]);
                const denominator = winnerStrength + loserStrength;
                strengths[winner] +=
                    learningRate * (1 - winnerStrength / denominator);
                strengths[loser] +=
                    learningRate * (-loserStrength / denominator);
            }
        }

        return ids
            .map((id) => ({
                ...this.ratings[id],
                score: Math.exp(strengths[id]),
            }))
            .sort((a, b) => (b.score || 0) - (a.score || 0));
    }

    private deleteMovie(id: string) {
        const nextRatings = { ...this.ratings };
        delete nextRatings[id];
        this.ratings = nextRatings;

        delete this.beatMap[id];
        this.manualList = this.manualList.filter((movieId) => movieId !== id);
        for (const winners of Object.values(this.beatMap)) {
            winners.delete(id);
        }

        this.persistState();
    }

    private getRankedList(): RankedMovie[] {
        if (this.sortMode === 'elo') {
            return Object.values(this.ratings).sort((a, b) => b.rating - a.rating);
        }

        if (this.sortMode === 'wins') {
            return Object.values(this.ratings).sort((a, b) => {
                const aGames = a.winCount + a.lossCount;
                const bGames = b.winCount + b.lossCount;
                const aRate = aGames ? a.winCount / aGames : 0;
                const bRate = bGames ? b.winCount / bGames : 0;
                return bRate - aRate;
            });
        }

        if (this.sortMode === 'transitive') return this.computeTransitiveScores();
        if (this.sortMode === 'manual') {
            return this.manualList
                .map((id) => this.ratings[id])
                .filter((movie): movie is MovieRating => Boolean(movie));
        }
        if (this.sortMode === 'copeland') return this.computeCopelandScores();
        if (this.sortMode === 'markov') return this.computeMarkovScores();
        return this.computeBradleyTerryScores();
    }

    private renderRankValue(movie: RankedMovie) {
        if (this.sortMode === 'elo') return `${Math.round(movie.rating)} pts`;
        if (this.sortMode === 'wins') {
            const totalGames = movie.winCount + movie.lossCount;
            return totalGames
                ? `${Math.round((movie.winCount / totalGames) * 100)}%`
                : '0%';
        }
        if (this.sortMode === 'manual') return '';
        if (this.sortMode === 'copeland') return `${movie.score} net wins`;
        if (this.sortMode === 'transitive') return `${movie.score} wins`;
        if (this.sortMode === 'markov')
            return `${((movie.score || 0) * 100).toFixed(2)}%`;
        return `${(movie.score || 0).toFixed(2)}%`;
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
            void this.skip(index);
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
                                  const otherMovie = this.movies[1 - index];
                                  if (otherMovie) void this.vote(movie, otherMovie);
                              }}
                          >
                              <img src=${imageUrl} alt=${movie.title} />
                          </button>`
                        : html`<button
                              class="poster-button poster-fallback"
                              @click=${() => {
                                  const otherMovie = this.movies[1 - index];
                                  if (otherMovie) void this.vote(movie, otherMovie);
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
                                void this.skip(index);
                            }}
                        >
                            Not Seen
                        </button>
                    </div>
                </article>
            </div>
        `;
    }

    render() {
        const ranked = this.getRankedList();
        const [left, right] = this.movies;

        return html`
            <utility-page-header title="Movie Faceoff"></utility-page-header>
            <section class="layout">
                <article class="faceoff-panel">
                    <header>
                        <h2>Pick a winner</h2>
                        <p>
                            Arrow keys vote left/right. Use Shift + arrows to skip one,
                            or Arrow Down to skip both. On touch, swipe a card outward
                            for “not seen”.
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
                                void this.skipBoth();
                            }}
                        >
                            Skip Both
                        </button>
                    </div>
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
                                    ).value as SortMode;
                                }}
                            >
                                <option value="elo">Elo Score</option>
                                <option value="wins">Win Rate</option>
                                <option value="transitive">Transitive Rank</option>
                                <option value="manual">Insert Rank</option>
                                <option value="copeland">Copeland Score</option>
                                <option value="markov">Markov Ranking</option>
                                <option value="bradley-terry">Bradley-Terry Ranking</option>
                            </select>
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
                                                            @click=${() => {
                                                                this.deleteMovie(movie.id);
                                                            }}
                                                        >
                                                            Remove
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
                </article>
            </section>
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
            .rankings-header {
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
            .error-message {
                color: var(--pico-del-color);
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
            }
        `,
    ];
}
