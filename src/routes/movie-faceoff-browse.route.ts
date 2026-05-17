import { css, html, nothing, PropertyValues } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { movieFaceoffShared } from '../movieFaceoffStyles';
import {
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';
import {
    FaceoffMovie,
    fetchMovieFaceoffPool,
    fetchTmdbMovie,
    getMoviePosterUrl,
    MovieFaceoffPoolEntry,
} from '../services/movie-faceoff.service';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import {
    getMovieFaceoffRankingAlgorithm,
    MOVIE_FACEOFF_RANKING_ALGORITHMS,
} from '../utils/movie-faceoff-rankings';
import {
    getPairwiseDisagreement,
    summarizeAgreement,
} from '../utils/movie-faceoff-rankings/pairwise-disagreement';
import '../components/jot-icon';
import '../components/movie-faceoff/movie-list-item.component';
import '../components/utility-page-header.component';
import { betterGo } from './route-config';

const INITIAL_VISIBLE = 50;
const LOAD_MORE_BATCH = 50;
const SENTINEL_ROOT_MARGIN = '400px';
const METADATA_CONCURRENCY = 4;
// Bayesian smoothing constant for weighted rating. A movie's own rating
// approaches its weighted score as voteCount surpasses BAYESIAN_PRIOR_VOTES;
// below it, the score is pulled toward the pool mean (the prior). 500 means a
// 50-vote movie scores ~9% own / 91% prior — strong enough to keep low-sample
// outliers from topping the list.
const BAYESIAN_PRIOR_VOTES = 500;

type BrowsePool = 'all' | 'ranked' | 'new' | 'unseen' | 'hidden';
type TmdbSort = 'tmdb-rating' | 'tmdb-votes';
type RankedSortMode = MovieFaceoffSortMode | TmdbSort;

const POOLS: ReadonlyArray<{ id: BrowsePool; label: string }> = [
    { id: 'all', label: 'All movies' },
    { id: 'ranked', label: 'My movies' },
    { id: 'new', label: 'New movies' },
    { id: 'unseen', label: 'Unseen' },
    { id: 'hidden', label: 'Hidden' },
];

const TMDB_SORTS: ReadonlyArray<{ id: TmdbSort; label: string }> = [
    { id: 'tmdb-rating', label: 'TMDB rating (weighted)' },
    { id: 'tmdb-votes', label: 'TMDB vote count' },
];

const TMDB_SORT_DESCRIPTIONS: Record<TmdbSort, string> = {
    'tmdb-rating':
        "Sorts by TMDB's vote_average smoothed via a Bayesian average against the pool mean. Movies with few votes are pulled toward the average so a 9.5 from 50 voters won't outrank an 8.0 from 50,000.\n\nMetric: weighted score on TMDB's 0–10 scale.\n\nInformational only — does not contribute to aggregate rankings.",
    'tmdb-votes':
        'Sorts by TMDB vote count, descending. A proxy for how broadly seen / discussed a movie is, regardless of opinion.\n\nMetric: vote count, abbreviated when ≥ 1000.\n\nInformational only — does not contribute to aggregate rankings.',
};

function isTmdbSort(value: string): value is TmdbSort {
    return value === 'tmdb-rating' || value === 'tmdb-votes';
}

type BrowseRow =
    | { kind: 'ranked'; ranked: MovieFaceoffRankedMovie }
    | { kind: 'pool'; entry: MovieFaceoffPoolEntry };

function formatRating(value: number | undefined): string {
    if (!Number.isFinite(value) || !value) return '—';
    return (value as number).toFixed(1);
}

function formatVoteCount(value: number | undefined): string {
    if (!Number.isFinite(value) || !value) return '—';
    if ((value as number) >= 1000) return `${((value as number) / 1000).toFixed(1)}k`;
    return String(value);
}

function computePoolMeanRating(pool: MovieFaceoffPoolEntry[]): number {
    if (!pool.length) return 0;
    let total = 0;
    let count = 0;
    for (const entry of pool) {
        if (entry.voteCount > 0 && Number.isFinite(entry.voteAverage)) {
            total += entry.voteAverage;
            count += 1;
        }
    }
    return count ? total / count : 0;
}

function bayesianWeightedRating(
    entry: MovieFaceoffPoolEntry,
    poolMean: number
): number {
    const v = entry.voteCount;
    const r = entry.voteAverage;
    if (!Number.isFinite(v) || v <= 0) return 0;
    return (v * r + BAYESIAN_PRIOR_VOTES * poolMean) / (v + BAYESIAN_PRIOR_VOTES);
}

@customElement('movie-faceoff-browse-route')
export class MovieFaceoffBrowseRoute extends MobxLitElement {
    @state()
    private poolMode: BrowsePool = 'new';

    @state()
    private tmdbSort: TmdbSort = 'tmdb-rating';

    @state()
    private rankedSort: RankedSortMode = 'elo';

    @state()
    private pool: MovieFaceoffPoolEntry[] = [];

    @state()
    private poolError = '';

    @state()
    private isLoadingPool = false;

    @state()
    private visibleCount = INITIAL_VISIBLE;

    @query('.list-sentinel')
    private sentinelRef?: HTMLElement;

    @query('dialog')
    private algorithmDialogRef?: HTMLDialogElement;

    private sentinelObserver?: IntersectionObserver;
    private observedSentinel?: Element;
    private inflightLoads = new Set<number>();
    private failedLoads = new Set<number>();

    connectedCallback() {
        super.connectedCallback();
        this.sentinelObserver = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    const total = this.rows.length;
                    if (this.visibleCount < total) {
                        this.visibleCount = Math.min(
                            this.visibleCount + LOAD_MORE_BATCH,
                            total
                        );
                    }
                }
            },
            { rootMargin: SENTINEL_ROOT_MARGIN }
        );
        void this.initialize();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.sentinelObserver?.disconnect();
        this.sentinelObserver = undefined;
        this.observedSentinel = undefined;
    }

    private async initialize() {
        this.isLoadingPool = true;
        this.poolError = '';
        try {
            await movieFaceoff.ensureLoaded();
            this.pool = await fetchMovieFaceoffPool();
        } catch (error) {
            this.poolError =
                error instanceof Error
                    ? error.message
                    : 'Unable to load movie pool.';
        } finally {
            this.isLoadingPool = false;
        }
    }

    private get decisiveIds(): Set<number> {
        return movieFaceoff.replayState.decisiveMovieIds;
    }

    private get excludedIds(): Set<number> {
        return movieFaceoff.excludedMovieIds;
    }

    private get unseenIds(): Set<number> {
        return movieFaceoff.unseenMovieIds;
    }

    private get poolMeanRating(): number {
        return computePoolMeanRating(this.pool);
    }

    private get poolEntryMap(): Map<number, MovieFaceoffPoolEntry> {
        return new Map(this.pool.map((entry) => [entry.id, entry] as const));
    }

    private get agreementSummary() {
        return summarizeAgreement(
            getPairwiseDisagreement(
                movieFaceoff.replayState,
                MOVIE_FACEOFF_RANKING_ALGORITHMS
            )
        );
    }

    private weightedRating(entry: MovieFaceoffPoolEntry): number {
        return bayesianWeightedRating(entry, this.poolMeanRating);
    }

    private rankedRowsByTmdb(sort: TmdbSort): BrowseRow[] {
        const ratings = movieFaceoff.replayState.ratings;
        const poolMap = this.poolEntryMap;
        const mean = this.poolMeanRating;
        const ranked = [...ratings.values()].filter(
            (m) => !m.excludedAt && !m.unseenAt
        );
        const score = (id: number): number => {
            const entry = poolMap.get(id);
            if (!entry) return Number.NEGATIVE_INFINITY;
            return sort === 'tmdb-rating'
                ? bayesianWeightedRating(entry, mean)
                : entry.voteCount;
        };
        ranked.sort((a, b) => {
            const diff = score(b.id) - score(a.id);
            if (diff !== 0) return diff;
            // Stable tiebreak when scores match (or both ids miss the pool).
            return a.title.localeCompare(b.title);
        });
        return ranked.map((m) => ({ kind: 'ranked', ranked: m }));
    }

    private get rankingAlgorithm() {
        if (isTmdbSort(this.rankedSort)) {
            // Fallback used only as a defensive default; callers that render
            // the algorithm dialog branch on isTmdbSort first.
            return getMovieFaceoffRankingAlgorithm('elo');
        }
        return getMovieFaceoffRankingAlgorithm(this.rankedSort);
    }

    private get currentSortLabel(): string {
        if (isTmdbSort(this.rankedSort)) {
            return (
                TMDB_SORTS.find((s) => s.id === this.rankedSort)?.label ??
                this.rankedSort
            );
        }
        return this.rankingAlgorithm.label;
    }

    private get currentSortDescription(): string {
        if (isTmdbSort(this.rankedSort)) {
            return TMDB_SORT_DESCRIPTIONS[this.rankedSort];
        }
        return this.rankingAlgorithm.description;
    }

    private get rows(): BrowseRow[] {
        if (this.poolMode === 'ranked') {
            // Mirror the rankings-panel UX: ranked-by-algorithm, with hidden
            // and explicitly-unseen movies kept out (they live under the
            // "Hidden" pool / aren't really "my movies" any more).
            if (isTmdbSort(this.rankedSort)) {
                return this.rankedRowsByTmdb(this.rankedSort);
            }
            return movieFaceoff
                .getRankedMovies(this.rankedSort)
                .filter((m) => !m.excludedAt && !m.unseenAt)
                .map((ranked) => ({ kind: 'ranked', ranked }));
        }

        const decisive = this.decisiveIds;
        const excluded = this.excludedIds;
        const unseen = this.unseenIds;
        const filtered = this.pool.filter((entry) => {
            switch (this.poolMode) {
                case 'all':
                    return true;
                case 'new':
                    // Unresponded: not voted, not excluded, not unseen.
                    return (
                        !decisive.has(entry.id) &&
                        !excluded.has(entry.id) &&
                        !unseen.has(entry.id)
                    );
                case 'unseen':
                    return unseen.has(entry.id);
                case 'hidden':
                    return excluded.has(entry.id);
            }
        });
        const sorted = [...filtered];
        if (this.tmdbSort === 'tmdb-rating') {
            const mean = this.poolMeanRating;
            sorted.sort(
                (a, b) =>
                    bayesianWeightedRating(b, mean) -
                        bayesianWeightedRating(a, mean) ||
                    b.voteCount - a.voteCount ||
                    a.id - b.id
            );
        } else {
            sorted.sort(
                (a, b) =>
                    b.voteCount - a.voteCount ||
                    b.voteAverage - a.voteAverage ||
                    a.id - b.id
            );
        }
        const poolRows: BrowseRow[] = sorted.map((entry) => ({
            kind: 'pool',
            entry,
        }));

        // 'new' is unresponded-only by definition, so voted-on movies don't
        // belong there. Everywhere else, the user's pool is the union of the
        // downloaded TMDB JSON and the movies they've responded to — so a
        // movie they voted on (or marked) stays visible even if it dropped
        // out of (or was never in) today's curated pool.
        if (this.poolMode === 'new') return poolRows;
        const poolIds = this.poolEntryMap;
        const ratings = movieFaceoff.replayState.ratings;
        const extras = [];
        for (const ranked of ratings.values()) {
            if (poolIds.has(ranked.id)) continue;
            const include =
                this.poolMode === 'all' ||
                (this.poolMode === 'unseen' && unseen.has(ranked.id)) ||
                (this.poolMode === 'hidden' && excluded.has(ranked.id));
            if (!include) continue;
            extras.push(ranked);
        }
        extras.sort((a, b) => a.title.localeCompare(b.title));
        return [
            ...poolRows,
            ...extras.map((ranked) => ({ kind: 'ranked' as const, ranked })),
        ];
    }

    willUpdate(changed: PropertyValues) {
        super.willUpdate(changed);
        if (
            changed.has('poolMode') ||
            changed.has('tmdbSort') ||
            changed.has('rankedSort') ||
            changed.has('pool')
        ) {
            this.visibleCount = INITIAL_VISIBLE;
        }
    }

    updated(changed: PropertyValues) {
        super.updated(changed);

        const sentinel = this.sentinelRef;
        if (this.sentinelObserver && sentinel !== this.observedSentinel) {
            if (this.observedSentinel)
                this.sentinelObserver.unobserve(this.observedSentinel);
            if (sentinel) this.sentinelObserver.observe(sentinel);
            this.observedSentinel = sentinel;
        }

        // Lazy-fetch metadata for the visible window of pool-backed rows.
        // Ranked movies already carry full metadata on the row itself.
        if (this.poolMode === 'ranked') return;
        const visible = this.rows.slice(0, this.visibleCount);
        const movieMap = movieFaceoff.movieMap;
        const todo: number[] = [];
        for (const row of visible) {
            if (row.kind !== 'pool') continue;
            if (movieMap.has(row.entry.id)) continue;
            if (this.inflightLoads.has(row.entry.id)) continue;
            if (this.failedLoads.has(row.entry.id)) continue;
            todo.push(row.entry.id);
        }
        if (todo.length) void this.loadMetadata(todo);
    }

    private async loadMetadata(ids: number[]) {
        ids.forEach((id) => this.inflightLoads.add(id));
        let cursor = 0;
        const buffer: FaceoffMovie[] = [];
        const FLUSH_EVERY = METADATA_CONCURRENCY;
        const flush = async () => {
            if (!buffer.length) return;
            const batch = buffer.splice(0, buffer.length);
            try {
                await movieFaceoff.upsertMoviesMetadata(batch);
            } catch {
                // upsert can fail under quota / IDB issues; the next render
                // will retry any missing ids that aren't marked failed.
            }
        };
        const worker = async () => {
            while (cursor < ids.length) {
                const id = ids[cursor];
                cursor += 1;
                try {
                    const movie = await fetchTmdbMovie(id);
                    buffer.push(movie);
                    if (buffer.length >= FLUSH_EVERY) await flush();
                } catch {
                    this.failedLoads.add(id);
                } finally {
                    this.inflightLoads.delete(id);
                }
            }
        };
        await Promise.all(
            Array.from(
                { length: Math.min(METADATA_CONCURRENCY, ids.length) },
                worker
            )
        );
        await flush();
    }

    private renderRow(row: BrowseRow, index: number) {
        if (row.kind === 'ranked') return this.renderRankedRow(row.ranked, index);
        return this.renderPoolRow(row.entry, index);
    }

    private renderRankedRow(ranked: MovieFaceoffRankedMovie, index: number) {
        const posterUrl = ranked.posterPath
            ? getMoviePosterUrl({ poster_path: ranked.posterPath })
            : '';
        const year = ranked.releaseDate?.split('-')[0] || 'Unknown year';
        const totalVotes = ranked.winCount + ranked.lossCount;
        const wlDetail = `${ranked.winCount}–${ranked.lossCount} · ${totalVotes} votes`;

        let metric: string;
        let metricLabel: string;
        let detail: string;
        if (isTmdbSort(this.rankedSort)) {
            const entry = this.poolEntryMap.get(ranked.id);
            if (this.rankedSort === 'tmdb-votes') {
                metric = formatVoteCount(entry?.voteCount);
                metricLabel = 'votes';
            } else {
                metric = entry
                    ? formatRating(this.weightedRating(entry))
                    : '—';
                metricLabel = 'weighted';
            }
            detail = entry
                ? `${formatRating(entry.voteAverage)} · ${formatVoteCount(
                      entry.voteCount
                  )} votes`
                : 'Not in TMDB pool';
        } else {
            metric = this.rankingAlgorithm.formatMetric(ranked);
            metricLabel = this.rankingAlgorithm.label;
            detail = wlDetail;
        }

        return html`
            <li>
                <movie-list-item
                    layout="stacked"
                    .posterUrl=${posterUrl}
                    .title=${ranked.title}
                    .subtitle=${year}
                >
                    <strong slot="leading" class="rank-index"
                        >${index + 1}</strong
                    >
                    <strong slot="trailing" class="rank-score">
                        <span class="metric-value">${metric}</span>
                        <span class="metric-label">${metricLabel}</span>
                        <span class="metric-detail">${detail}</span>
                    </strong>
                    ${this.renderRowActions(ranked.id)}
                </movie-list-item>
            </li>
        `;
    }

    private renderPoolRow(entry: MovieFaceoffPoolEntry, index: number) {
        const movie = movieFaceoff.movieMap.get(entry.id);
        const title = movie?.title ?? `Movie #${entry.id}`;
        const posterUrl = movie?.posterPath
            ? getMoviePosterUrl({ poster_path: movie.posterPath })
            : '';
        const year = movie?.releaseDate?.split('-')[0];
        const subtitle = movie ? year || 'Unknown year' : 'Loading…';
        const sortByVotes = this.tmdbSort === 'tmdb-votes';
        const metric = sortByVotes
            ? formatVoteCount(entry.voteCount)
            : formatRating(this.weightedRating(entry));
        const metricLabel = sortByVotes ? 'votes' : 'weighted';
        const ratingDetail = `${formatRating(entry.voteAverage)} · ${formatVoteCount(
            entry.voteCount
        )} votes`;

        return html`
            <li>
                <movie-list-item
                    layout="stacked"
                    .posterUrl=${posterUrl}
                    .title=${title}
                    .subtitle=${subtitle}
                >
                    <strong slot="leading" class="rank-index"
                        >${index + 1}</strong
                    >
                    <strong slot="trailing" class="rank-score">
                        <span class="metric-value">${metric}</span>
                        <span class="metric-label">${metricLabel}</span>
                        <span class="metric-detail">${ratingDetail}</span>
                    </strong>
                    ${this.renderRowActions(entry.id)}
                </movie-list-item>
            </li>
        `;
    }

    private renderRowActions(movieId: number) {
        return html`
            <span slot="trailing" role="group">
                <button
                    class="outline"
                    @click=${() =>
                        betterGo('movie-faceoff-movie', {
                            pathParams: { id: movieId },
                        })}
                >
                    Details
                </button>
                <button
                    class="outline"
                    @click=${() =>
                        betterGo('movie-faceoff', {
                            queryParams: { targetMovieId: movieId },
                        })}
                >
                    Compare
                </button>
            </span>
        `;
    }

    private renderSortControl() {
        if (this.poolMode === 'ranked') {
            return html`
                <div class="sort-row" role="group">
                    <select
                        @change=${(e: Event) => {
                            this.rankedSort = (
                                e.currentTarget as HTMLSelectElement
                            ).value as RankedSortMode;
                        }}
                    >
                        <optgroup label="Combined">
                            ${MOVIE_FACEOFF_RANKING_ALGORITHMS.filter(
                                (a) => a.isAggregate
                            ).map(
                                (algorithm) => html`
                                    <option
                                        value=${algorithm.id}
                                        ?selected=${algorithm.id ===
                                        this.rankedSort}
                                    >
                                        ${algorithm.label}
                                    </option>
                                `
                            )}
                        </optgroup>
                        <optgroup label="Individual">
                            ${MOVIE_FACEOFF_RANKING_ALGORITHMS.filter(
                                (a) => !a.isAggregate && !a.isInformational
                            ).map(
                                (algorithm) => html`
                                    <option
                                        value=${algorithm.id}
                                        ?selected=${algorithm.id ===
                                        this.rankedSort}
                                    >
                                        ${algorithm.label}
                                    </option>
                                `
                            )}
                        </optgroup>
                        <optgroup label="Informational">
                            ${MOVIE_FACEOFF_RANKING_ALGORITHMS.filter(
                                (a) => a.isInformational
                            ).map(
                                (algorithm) => html`
                                    <option
                                        value=${algorithm.id}
                                        ?selected=${algorithm.id ===
                                        this.rankedSort}
                                    >
                                        ${algorithm.label}
                                    </option>
                                `
                            )}
                            ${TMDB_SORTS.map(
                                (item) => html`
                                    <option
                                        value=${item.id}
                                        ?selected=${item.id === this.rankedSort}
                                    >
                                        ${item.label}
                                    </option>
                                `
                            )}
                        </optgroup>
                    </select>
                    <button
                        class="outline info-button"
                        aria-label="About the current ranking method"
                        @click=${() => this.algorithmDialogRef?.showModal()}
                    >
                        <jot-icon name="Info"></jot-icon>
                    </button>
                </div>
            `;
        }
        return html`
            <div class="sort-row">
                <select
                    @change=${(e: Event) => {
                        this.tmdbSort = (
                            e.currentTarget as HTMLSelectElement
                        ).value as TmdbSort;
                    }}
                >
                    ${TMDB_SORTS.map(
                        (item) => html`
                            <option
                                value=${item.id}
                                ?selected=${item.id === this.tmdbSort}
                            >
                                ${item.label}
                            </option>
                        `
                    )}
                </select>
            </div>
        `;
    }

    private renderEmpty() {
        if (this.isLoadingPool) {
            return html`<article class="empty-state-panel">
                <p>Loading movie pool…</p>
            </article>`;
        }
        if (this.poolError) {
            return html`<article class="empty-state-panel">
                <p>${this.poolError}</p>
            </article>`;
        }
        if (this.poolMode === 'ranked') {
            return html`<article class="empty-state-panel">
                <jot-icon name="TrendingUp" size="large"></jot-icon>
                <p>Vote a few times to start building your list.</p>
            </article>`;
        }
        return html`<article class="empty-state-panel">
            <jot-icon name="Film" size="large"></jot-icon>
            <p>No movies in this pool yet.</p>
        </article>`;
    }

    render() {
        const list = this.rows;
        const visible = list.slice(0, this.visibleCount);
        const hasMore = visible.length < list.length;
        const agreement = this.agreementSummary;
        // Hide the chip until there's enough data for the number to mean
        // something — vacuous unanimity on the first couple of votes is
        // misleading at any granularity.
        const showAgreement = agreement.coveredPairs >= 20;

        return html`
            <utility-page-header
                title="Browse Movies"
                backHref="/movie-faceoff"
                backLabel="Movie Faceoff"
                useHistoryBack
            ></utility-page-header>
            <main class="layout">
                <article class="surface-panel">
                    <header class="panel-header">
                        <hgroup>
                            <p class="eyebrow">Discover & re-explore</p>
                            <h2>Browse the pool</h2>
                            <p class="text-muted">
                                ${this.isLoadingPool
                                    ? 'Loading…'
                                    : `${list.length.toLocaleString()} movies`}
                            </p>
                            ${showAgreement
                                ? html`<p class="settlement-chip">
                                      Algorithm agreement
                                      <strong
                                          >${(
                                              agreement.agreement * 100
                                          ).toFixed(0)}%</strong
                                      >
                                  </p>`
                                : nothing}
                        </hgroup>
                    </header>

                    <div class="filter-row" role="group" aria-label="Pool">
                        ${POOLS.map(
                            (item) => html`
                                <button
                                    class=${this.poolMode === item.id
                                        ? 'primary'
                                        : 'outline'}
                                    @click=${() => {
                                        this.poolMode = item.id;
                                    }}
                                >
                                    ${item.label}
                                </button>
                            `
                        )}
                    </div>

                    ${this.renderSortControl()}

                    ${list.length
                        ? html`<ol class="movie-list">
                              ${repeat(
                                  visible,
                                  (row) =>
                                      row.kind === 'ranked'
                                          ? row.ranked.id
                                          : row.entry.id,
                                  (row, index) => this.renderRow(row, index)
                              )}
                              ${hasMore
                                  ? html`<li
                                        class="list-sentinel"
                                        aria-hidden="true"
                                    ></li>`
                                  : nothing}
                          </ol>`
                        : this.renderEmpty()}
                </article>
            </main>

            <dialog
                @click=${(e: Event) => {
                    if ((e.target as Element).nodeName === 'DIALOG')
                        (e.target as HTMLDialogElement).close();
                }}
            >
                <article>
                    <header>
                        <p class="eyebrow">Current ranking method</p>
                        <h3>${this.currentSortLabel}</h3>
                    </header>
                    ${this.currentSortDescription
                        .split('\n\n')
                        .filter(Boolean)
                        .map((paragraph) => html`<p>${paragraph}</p>`)}
                    <footer>
                        <button @click=${() => this.algorithmDialogRef?.close()}>
                            Close
                        </button>
                    </footer>
                </article>
            </dialog>
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
                width: min(100%, 60rem);
                margin-inline: auto;
            }
            .surface-panel {
                position: relative;
                overflow: hidden;
                margin: 0;
            }
            .panel-header {
                margin-bottom: 1rem;
            }
            .settlement-chip {
                display: inline-flex;
                align-items: baseline;
                gap: 0.4rem;
                margin: 0.25rem 0 0;
                padding: 0.15rem 0.6rem;
                border-radius: 999px;
                background: var(--pico-card-sectioning-background-color);
                color: var(--pico-muted-color);
                font-size: 0.8rem;
                width: fit-content;
            }
            .settlement-chip strong {
                color: var(--pico-color);
                font-variant-numeric: tabular-nums;
            }
            .filter-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.5rem;
                margin-bottom: 0.75rem;
            }
            .filter-row button {
                margin: 0;
                padding-inline: 0.85rem;
            }
            .sort-row {
                display: flex;
                gap: 0.5rem;
                align-items: stretch;
                margin-bottom: 1.25rem;
            }
            .sort-row select {
                margin: 0;
                flex: 1 1 auto;
            }
            .sort-row .info-button {
                flex: 0 0 3rem;
                width: 3rem;
                padding: 0;
                margin: 0;
            }
            .rank-index {
                width: 2rem;
                height: 2rem;
                display: grid;
                place-items: center;
                border-radius: 999px;
                background: var(--pico-primary-background);
                color: var(--pico-primary-inverse);
                font-size: 0.85rem;
                line-height: 1;
                flex-shrink: 0;
                padding: 0;
                --pico-line-height: 1;
            }
            .rank-score {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                font-variant-numeric: tabular-nums;
                line-height: 1.1;
            }
            .metric-value {
                font-size: 1.05rem;
            }
            .metric-label {
                font-size: 0.7rem;
                color: var(--pico-muted-color);
                text-transform: uppercase;
                letter-spacing: 0.04em;
            }
            .metric-detail {
                font-size: 0.7rem;
                color: var(--pico-muted-color);
                font-weight: normal;
            }
            .list-sentinel {
                list-style: none;
                height: 1px;
                margin: 0;
                padding: 0;
            }
            .empty-state-panel {
                display: grid;
                gap: 0.85rem;
                place-items: center;
                text-align: center;
                margin: 0;
                padding: 2rem 1rem;
            }
            .empty-state-panel p {
                margin: 0;
                color: var(--pico-muted-color);
            }
            dialog::backdrop {
                background: color-mix(in srgb, black 55%, transparent);
            }
        `,
    ];
}

declare global {
    interface HTMLElementTagNameMap {
        'movie-faceoff-browse-route': MovieFaceoffBrowseRoute;
    }
}
