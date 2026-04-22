import { css, html, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation, WebComponentInterface } from '@vaadin/router';
import { base } from '../baseStyles';
import { movieFaceoffShared } from '../movieFaceoffStyles';
import '../components/jot-icon';
import '../components/utility-page-header.component';
import { betterGo } from './route-config';
import {
    FaceoffMovieCastMember,
    FaceoffMovieDetails,
    fetchTmdbMovieDetails,
    getCastProfileUrl,
    getMovieBackdropUrl,
    getMoviePosterUrl,
} from '../services/movie-faceoff.service';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import {
    MOVIE_FACEOFF_RANKING_ALGORITHMS,
    MovieFaceoffRankingAlgorithm,
} from '../utils/movie-faceoff-rankings';

type RankingSnapshot = {
    algorithm: MovieFaceoffRankingAlgorithm;
    rank: number | null;
    total: number;
    percentile: number | null;
    metric: string;
};

const MAX_CAST = 12;

@customElement('movie-faceoff-movie-route')
export class MovieFaceoffMovieRoute
    extends MobxLitElement
    implements WebComponentInterface
{
    @state()
    private movieId?: number;

    @state()
    private details?: FaceoffMovieDetails;

    @state()
    private isLoading = false;

    @state()
    private errorMessage = '';

    @state()
    private activeMethod?: MovieFaceoffRankingAlgorithm;

    @query('#method-dialog')
    private methodDialog!: HTMLDialogElement;

    async onAfterEnter(location: RouterLocation) {
        const rawId = Number(location.params.id);
        if (!Number.isFinite(rawId) || rawId <= 0) {
            this.movieId = undefined;
            this.details = undefined;
            this.errorMessage = 'That movie page could not be found.';
            return;
        }

        this.movieId = rawId;
        await Promise.all([movieFaceoff.ensureLoaded(), this.loadMovie()]);
    }

    private get replayState() {
        return movieFaceoff.replayState;
    }

    private get storedMovie() {
        if (!this.movieId) return undefined;
        return movieFaceoff.movieMap.get(this.movieId);
    }

    private get rating() {
        return this.replayState.ratings.get(this.movieId || 0);
    }

    private get rankingSnapshots(): RankingSnapshot[] {
        const movieId = this.movieId;
        if (!movieId) return [];

        return MOVIE_FACEOFF_RANKING_ALGORITHMS.filter(
            (algorithm) => !algorithm.isInformational || algorithm.id === 'uncertainty'
        ).map((algorithm) => {
            const ranked = algorithm
                .rank(this.replayState, MOVIE_FACEOFF_RANKING_ALGORITHMS)
                .filter((movie) => !movie.excludedAt && !movie.unseenAt);
            const index = ranked.findIndex((movie) => movie.id === movieId);
            const rankedMovie = index === -1 ? undefined : ranked[index];
            const total = ranked.length;
            const rank = index === -1 ? null : index + 1;
            const percentile =
                rank === null || total <= 1 ? null : (rank - 1) / (total - 1);

            return {
                algorithm,
                rank,
                total,
                percentile,
                metric: rankedMovie
                    ? algorithm.formatMetric(rankedMovie)
                    : 'Not ranked yet',
            };
        });
    }

    private get chartSnapshots(): RankingSnapshot[] {
        return this.rankingSnapshots.filter(
            (s) => s.algorithm.id !== 'uncertainty'
        );
    }

    private get uncertaintySnapshot() {
        return this.rankingSnapshots.find((s) => s.algorithm.id === 'uncertainty');
    }

    private get rankRange() {
        const ranks = this.chartSnapshots
            .filter((s) => !s.algorithm.isAggregate)
            .map((s) => s.rank)
            .filter((r): r is number => r !== null);
        if (!ranks.length) return null;
        return { min: Math.min(...ranks), max: Math.max(...ranks) };
    }

    private get headlineSnapshot() {
        return this.chartSnapshots.find((s) => s.algorithm.id === 'rrf');
    }

    private get winRate(): string {
        const rating = this.rating;
        const total = (rating?.winCount || 0) + (rating?.lossCount || 0);
        if (!total) return '—';
        return `${Math.round(((rating?.winCount || 0) / total) * 100)}%`;
    }

    private get director() {
        return this.details?.credits?.crew?.find((person) => person.job === 'Director');
    }

    private get topCast(): FaceoffMovieCastMember[] {
        const cast = this.details?.credits?.cast || [];
        return cast
            .slice()
            .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
            .slice(0, MAX_CAST);
    }

    private async loadMovie() {
        if (!this.movieId) return;

        this.isLoading = true;
        this.errorMessage = '';
        try {
            this.details = await fetchTmdbMovieDetails(this.movieId);
            await movieFaceoff.upsertMoviesMetadata([this.details]);
        } catch (error) {
            this.details = undefined;
            this.errorMessage =
                error instanceof Error ? error.message : 'Unable to load movie details.';
        } finally {
            this.isLoading = false;
        }
    }

    private formatDate(date?: string) {
        if (!date) return 'Unknown';
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) return date;
        return parsed.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    private formatRuntime(runtime?: number) {
        if (!runtime) return '';
        const hours = Math.floor(runtime / 60);
        const minutes = runtime % 60;
        if (!hours) return `${minutes}m`;
        if (!minutes) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    }

    private formatVoteAverage(voteAverage?: number, voteCount?: number) {
        if (!voteAverage) return '';
        const score = voteAverage.toFixed(1);
        if (!voteCount) return `TMDB ${score}/10`;
        return `TMDB ${score}/10 (${voteCount.toLocaleString()})`;
    }

    private openMethodDialog(algorithm: MovieFaceoffRankingAlgorithm) {
        this.activeMethod = algorithm;
        this.methodDialog.showModal();
    }

    private closeMethodDialog() {
        this.methodDialog.close();
    }

    private renderHero() {
        const details = this.details;
        const storedMovie = this.storedMovie;
        const title = details?.title || storedMovie?.title || 'Movie';
        const posterUrl = getMoviePosterUrl(
            details || { poster_path: storedMovie?.posterPath }
        );
        const backdropUrl = getMovieBackdropUrl(details || { backdrop_path: undefined });
        const year = (details?.release_date || storedMovie?.releaseDate || '').split(
            '-'
        )[0];
        const genres = details?.genres?.map((g) => g.name).join(' · ') || '';
        const director = this.director;

        const pills = [
            this.formatDate(details?.release_date || storedMovie?.releaseDate),
            this.formatRuntime(details?.runtime),
            genres,
            this.formatVoteAverage(details?.vote_average, details?.vote_count),
            storedMovie ? `Tracked ${this.formatDate(storedMovie.createdAt)}` : '',
        ].filter(Boolean);

        return html`
            <section class="hero surface-panel">
                <div
                    class="hero-banner ${backdropUrl ? 'has-image' : ''}"
                    style=${backdropUrl ? `background-image:url(${backdropUrl});` : ''}
                ></div>
                <div class="hero-body">
                    <div class="poster-shell">
                        ${posterUrl
                            ? html`<img class="poster" src=${posterUrl} alt=${title} />`
                            : html`<div class="poster poster-fallback">
                                  <jot-icon name="Play" size="xlarge"></jot-icon>
                              </div>`}
                    </div>
                    <div class="hero-copy">
                        <p class="eyebrow">Movie Faceoff</p>
                        <h2>
                            ${title}${year
                                ? html` <span>(${year})</span>`
                                : nothing}
                        </h2>
                        ${details?.tagline
                            ? html`<p class="tagline">${details.tagline}</p>`
                            : nothing}
                        ${director
                            ? html`<p class="director">
                                  Directed by <strong>${director.name}</strong>
                              </p>`
                            : nothing}
                        ${pills.length
                            ? html`<div class="pill-row">
                                  ${pills.map((p) => html`<span>${p}</span>`)}
                              </div>`
                            : nothing}
                        <p class="summary">
                            ${(
                                details?.overview ||
                                'No plot summary is available for this movie yet.'
                            ).trim()}
                        </p>
                    </div>
                </div>
            </section>
        `;
    }

    private renderRankingAnalysis() {
        const headline = this.headlineSnapshot;
        const uncertainty = this.uncertaintySnapshot;
        const range = this.rankRange;
        const total = headline?.total || 0;

        return html`
            <section class="surface-panel section-card">
                <header class="section-header">
                    <hgroup>
                        <p class="eyebrow">Ranking analysis</p>
                        <h3>How this movie ranks</h3>
                    </hgroup>
                </header>

                <div class="headline-row">
                    <article class="headline-card">
                        <p class="card-eyebrow">Weighted Consensus</p>
                        <div class="rank-headline">
                            <span class="rank-big"
                                >${headline?.rank === null ||
                                headline?.rank === undefined
                                    ? '—'
                                    : `#${headline.rank}`}</span
                            >
                            ${total
                                ? html`<span class="rank-of">of ${total}</span>`
                                : nothing}
                        </div>
                        <p class="card-note">
                            The headline rank — reflects agreement across all
                            primary methods.
                        </p>
                    </article>

                    <article class="uncertainty-card">
                        <p class="card-eyebrow">Uncertainty across methods</p>
                        <div class="uncertainty-value">
                            <strong>${uncertainty?.metric || '—'}</strong>
                            <span class="muted">spread</span>
                        </div>
                        ${range && total
                            ? html`
                                  <div class="range-track">
                                      <div
                                          class="range-fill"
                                          style="left:${((range.min - 1) /
                                              Math.max(1, total - 1)) *
                                          100}%; right:${(1 -
                                              (range.max - 1) /
                                                  Math.max(1, total - 1)) *
                                          100}%"
                                      ></div>
                                  </div>
                                  <div class="range-endpoints">
                                      <span>Best: #${range.min}</span>
                                      <span>Worst: #${range.max}</span>
                                  </div>
                              `
                            : nothing}
                    </article>
                </div>
            </section>
        `;
    }

    private renderRankChart() {
        const snapshots = this.chartSnapshots;
        if (!snapshots.length) return nothing;

        const aggregates = snapshots.filter((s) => s.algorithm.isAggregate);
        const primaries = snapshots.filter(
            (s) => !s.algorithm.isAggregate && !s.algorithm.isInformational
        );

        const renderRow = (snapshot: RankingSnapshot) => {
            const pct = snapshot.percentile;
            const isAgg = snapshot.algorithm.isAggregate;
            return html`
                <button
                    class="name ${isAgg ? 'aggregate' : ''}"
                    @click=${() => this.openMethodDialog(snapshot.algorithm)}
                    aria-label="About ${snapshot.algorithm.label}"
                >
                    ${snapshot.algorithm.label}
                </button>
                <div class="track">
                    ${pct === null
                        ? nothing
                        : html`<span
                              class="dot ${isAgg ? '' : 'muted'}"
                              style="left:${pct * 100}%"
                          ></span>`}
                </div>
                <span class="rank">
                    ${snapshot.rank === null ? '—' : `#${snapshot.rank}`}
                </span>
            `;
        };

        return html`
            <section class="surface-panel section-card">
                <header class="section-header chart-header">
                    <hgroup>
                        <p class="eyebrow">Rank distribution</p>
                        <h3>Where it lands across methods</h3>
                    </hgroup>
                    <p class="chart-caption">
                        Each dot marks this movie in that method (left = top, right =
                        bottom). Tap a method name for details.
                    </p>
                </header>

                <div class="dist">
                    ${aggregates.length
                        ? html`
                              <div class="group-label">Aggregate</div>
                              ${aggregates.map(renderRow)}
                          `
                        : nothing}
                    ${primaries.length
                        ? html`
                              <div class="divider"></div>
                              <div class="group-label">Individual methods</div>
                              ${primaries.map(renderRow)}
                          `
                        : nothing}
                </div>
            </section>
        `;
    }

    private renderVoteHistory() {
        const rating = this.rating;
        const won = rating?.winCount || 0;
        const lost = rating?.lossCount || 0;
        return html`
            <section class="surface-panel section-card">
                <header class="section-header">
                    <hgroup>
                        <p class="eyebrow">Vote history</p>
                        <h3>Your faceoffs</h3>
                    </hgroup>
                </header>
                <div class="stats-grid">
                    <article class="stat-card">
                        <p>Votes won</p>
                        <strong>${won}</strong>
                    </article>
                    <article class="stat-card">
                        <p>Votes lost</p>
                        <strong>${lost}</strong>
                    </article>
                    <article class="stat-card">
                        <p>Win rate</p>
                        <strong>${this.winRate}</strong>
                    </article>
                    <article class="stat-card">
                        <p>Total faceoffs</p>
                        <strong>${won + lost}</strong>
                    </article>
                    <article class="stat-card">
                        <p>Elo rating</p>
                        <strong>${Math.round(rating?.rating || 1500)}</strong>
                    </article>
                </div>
            </section>
        `;
    }

    private renderCast() {
        const cast = this.topCast;
        if (!cast.length) return nothing;

        return html`
            <section class="surface-panel section-card">
                <header class="section-header">
                    <hgroup>
                        <p class="eyebrow">Top billed cast</p>
                        <h3>Cast</h3>
                    </hgroup>
                </header>
                <ul class="cast-row">
                    ${cast.map((person) => {
                        const profileUrl = getCastProfileUrl(person);
                        return html`
                            <li class="cast-card">
                                ${profileUrl
                                    ? html`<img
                                          class="cast-photo"
                                          src=${profileUrl}
                                          alt=${person.name}
                                          loading="lazy"
                                      />`
                                    : html`<div class="cast-photo cast-photo-fallback">
                                          <span>${person.name.charAt(0)}</span>
                                      </div>`}
                                <p class="cast-name">${person.name}</p>
                                ${person.character
                                    ? html`<p class="cast-character">
                                          ${person.character}
                                      </p>`
                                    : nothing}
                            </li>
                        `;
                    })}
                </ul>
            </section>
        `;
    }

    private renderMethodDialog() {
        const method = this.activeMethod;
        return html`
            <dialog
                id="method-dialog"
                @click=${(e: Event) => {
                    if ((e.target as Element).nodeName === 'DIALOG')
                        this.closeMethodDialog();
                }}
            >
                <article>
                    <header>
                        <p class="eyebrow">Ranking method</p>
                        <h3>${method?.label || ''}</h3>
                    </header>
                    ${(method?.description || '')
                        .split('\n\n')
                        .filter(Boolean)
                        .map((p) => html`<p>${p}</p>`)}
                    <footer>
                        <button @click=${() => this.closeMethodDialog()}>Close</button>
                    </footer>
                </article>
            </dialog>
        `;
    }

    render() {
        const details = this.details;
        const storedMovie = this.storedMovie;

        return html`
            <utility-page-header
                backHref="/movie-faceoff"
                backLabel="Movie Faceoff"
                useHistoryBack
            >
                ${this.movieId
                    ? html`
                          <button
                              slot="actions"
                              class="outline header-action-button"
                              @click=${() => {
                                  betterGo('movie-faceoff', {
                                      queryParams: { targetMovieId: this.movieId },
                                  });
                              }}
                          >
                              <jot-icon name="TrendingUp"></jot-icon>
                              <span>Rank</span>
                          </button>
                      `
                    : nothing}
            </utility-page-header>
            <main class="layout">
                ${this.errorMessage
                    ? html`<article class="surface-panel error-panel">
                          <jot-icon name="AlertTriangle"></jot-icon>
                          <p>${this.errorMessage}</p>
                      </article>`
                    : nothing}
                ${this.isLoading && !details
                    ? html`<article class="surface-panel loading-panel">
                          <p>Loading movie details...</p>
                      </article>`
                    : nothing}
                ${details || storedMovie
                    ? html`
                          ${this.renderHero()} ${this.renderRankingAnalysis()}
                          ${this.renderRankChart()} ${this.renderVoteHistory()}
                          ${this.renderCast()}
                      `
                    : nothing}
                ${!this.errorMessage && !this.isLoading && !details && !storedMovie
                    ? html`<article class="surface-panel empty-panel">
                          <p>No movie is selected.</p>
                      </article>`
                    : nothing}
            </main>
            ${this.renderMethodDialog()}
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
                width: min(100%, 68rem);
                margin-inline: auto;
            }
            .header-action-button {
                margin: 0;
                padding-inline: 0.7rem;
                min-height: 2.25rem;
            }
            .layout {
                display: grid;
                gap: 1rem;
            }
            .surface-panel {
                position: relative;
                overflow: hidden;
                margin: 0;
            }

            /* ---------- HERO ---------- */
            .hero {
                padding: 0;
            }
            .hero-banner {
                position: relative;
                aspect-ratio: 16 / 6;
                background-size: cover;
                background-position: center 30%;
                background-color: var(--pico-card-sectioning-background-color);
            }
            .hero-banner::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(
                    180deg,
                    color-mix(in srgb, black 15%, transparent),
                    var(--pico-card-background-color) 95%
                );
            }
            .hero-body {
                position: relative;
                z-index: 1;
                padding: 0 1.5rem 1.5rem;
                display: grid;
                grid-template-columns: 14rem minmax(0, 1fr);
                gap: 1.5rem;
                align-items: start;
                margin-top: -7rem;
            }
            .section-card {
                position: relative;
                z-index: 1;
            }
            .poster-shell {
                max-width: 14rem;
            }
            .poster {
                display: block;
                width: 100%;
                aspect-ratio: 2 / 3;
                object-fit: cover;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
                border: 1px solid color-mix(in srgb, white 10%, transparent);
            }
            .poster-fallback {
                display: grid;
                place-items: center;
            }
            .hero-copy {
                padding-top: 7rem;
            }
            .hero-copy {
                min-width: 0;
            }
            .hero-copy .eyebrow {
                margin: 0 0 0.2rem;
            }
            .hero-copy h2 {
                margin: 0;
                font-size: 1.5rem;
                line-height: 1.2;
            }
            .hero-copy h2 span {
                color: var(--pico-muted-color);
                font-weight: 500;
            }
            .tagline {
                color: var(--pico-muted-color);
                font-style: italic;
                margin: 0.3rem 0 0.4rem;
            }
            .director {
                margin: 0.2rem 0 0.6rem;
                font-size: 0.92rem;
                color: var(--pico-muted-color);
            }
            .director strong {
                color: var(--pico-color);
                font-weight: 600;
            }
            .summary {
                margin: 0.9rem 0 0;
                font-size: 0.98rem;
                line-height: 1.55;
            }
            .pill-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.4rem;
                margin-top: 0.75rem;
            }
            .pill-row span {
                padding: 0.25rem 0.65rem;
                border-radius: 999px;
                background: var(--pico-card-sectioning-background-color);
                font-size: 0.82rem;
                color: var(--pico-muted-color);
            }

            /* ---------- SECTIONS ---------- */
            .section-card {
                display: grid;
                gap: 1rem;
                padding: 1.25rem;
            }
            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: baseline;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .section-header hgroup {
                margin: 0;
            }
            .section-header h3 {
                margin: 0;
                font-size: 1.05rem;
            }
            .eyebrow {
                margin: 0 0 0.15rem;
                font-size: 0.75rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--pico-muted-color);
            }
            .chart-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .chart-caption {
                margin: 0;
                color: var(--pico-muted-color);
                font-size: 0.85rem;
            }

            /* ---------- HEADLINE + UNCERTAINTY ---------- */
            .headline-row {
                display: grid;
                grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
                gap: 1rem;
            }
            .headline-card,
            .uncertainty-card {
                margin: 0;
                padding: 1.1rem 1.25rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .headline-card {
                background: color-mix(
                    in srgb,
                    var(--pico-primary-background) 14%,
                    var(--pico-card-sectioning-background-color)
                );
                border: 1px solid
                    color-mix(in srgb, var(--pico-primary) 35%, transparent);
            }
            .card-eyebrow {
                margin: 0 0 0.45rem;
                font-size: 0.72rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--pico-muted-color);
            }
            .rank-headline {
                display: flex;
                align-items: baseline;
                gap: 0.4rem;
            }
            .rank-big {
                font-size: 2.6rem;
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
                color: var(--pico-primary);
            }
            .rank-of {
                color: var(--pico-muted-color);
                font-size: 0.95rem;
                font-weight: 500;
            }
            .card-note {
                margin: 0.55rem 0 0;
                color: var(--pico-muted-color);
                font-size: 0.88rem;
            }
            .uncertainty-value {
                display: flex;
                align-items: baseline;
                gap: 0.4rem;
            }
            .uncertainty-value strong {
                font-size: 1.5rem;
                font-variant-numeric: tabular-nums;
            }
            .muted {
                color: var(--pico-muted-color);
                font-size: 0.9rem;
            }
            .range-track {
                position: relative;
                height: 0.55rem;
                border-radius: 999px;
                background: color-mix(in srgb, var(--pico-muted-color) 20%, transparent);
                margin-top: 0.7rem;
            }
            .range-fill {
                position: absolute;
                top: 0;
                bottom: 0;
                border-radius: inherit;
                background: linear-gradient(
                    90deg,
                    color-mix(in srgb, var(--pico-primary) 75%, transparent),
                    color-mix(in srgb, var(--pico-del-color) 75%, transparent)
                );
            }
            .range-endpoints {
                display: flex;
                justify-content: space-between;
                font-size: 0.78rem;
                color: var(--pico-muted-color);
                margin-top: 0.25rem;
                font-variant-numeric: tabular-nums;
            }

            /* ---------- RANK DISTRIBUTION ---------- */
            .dist {
                display: grid;
                grid-template-columns: 10rem minmax(0, 1fr) 3.5rem;
                gap: 0.65rem 1rem;
                align-items: center;
                font-size: 0.9rem;
            }
            .group-label {
                grid-column: 1 / -1;
                font-size: 0.72rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--pico-muted-color);
                margin-top: 0.3rem;
            }
            .divider {
                grid-column: 1 / -1;
                height: 1px;
                background: color-mix(in srgb, var(--pico-muted-color) 18%, transparent);
                margin: 0.1rem 0;
            }
            .dist .name {
                color: var(--pico-color);
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                background: none;
                border: 0;
                padding: 0;
                margin: 0;
                text-align: left;
                font: inherit;
                cursor: pointer;
                display: flex;
                justify-self: start;
                justify-content: flex-start;
                align-items: center;
                gap: 0.4rem;
                line-height: 1.2;
            }
            .dist .name::after {
                content: 'ⓘ';
                color: var(--pico-muted-color);
                font-size: 0.85em;
                opacity: 0.55;
                transition: opacity 120ms ease;
            }
            .dist .name:hover,
            .dist .name:focus-visible {
                color: var(--pico-primary);
                outline: none;
            }
            .dist .name:hover::after,
            .dist .name:focus-visible::after {
                opacity: 1;
                color: var(--pico-primary);
            }
            .dist .name.aggregate {
                color: var(--pico-primary);
                font-weight: 600;
            }
            .dist .name.aggregate::after {
                color: var(--pico-primary);
            }
            .track {
                position: relative;
                height: 0.55rem;
                border-radius: 999px;
                background: color-mix(in srgb, var(--pico-muted-color) 14%, transparent);
            }
            .dot {
                position: absolute;
                top: 50%;
                width: 1rem;
                height: 1rem;
                border-radius: 999px;
                transform: translate(-50%, -50%);
                background: var(--pico-primary);
                box-shadow: 0 0 0 3px
                    color-mix(in srgb, var(--pico-primary) 25%, transparent);
            }
            .dot.muted {
                background: color-mix(in srgb, var(--pico-color) 65%, transparent);
                box-shadow: 0 0 0 3px
                    color-mix(in srgb, var(--pico-color) 18%, transparent);
            }
            .dist .rank {
                text-align: right;
                font-variant-numeric: tabular-nums;
                font-weight: 600;
            }

            /* ---------- STATS ---------- */
            .stats-grid {
                display: grid;
                gap: 0.6rem;
                grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
            }
            .stat-card {
                display: grid;
                gap: 0.25rem;
                margin: 0;
                padding: 0.75rem 0.9rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .stat-card p {
                margin: 0;
                font-size: 0.74rem;
                color: var(--pico-muted-color);
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }
            .stat-card strong {
                font-size: 1.15rem;
                font-variant-numeric: tabular-nums;
            }

            /* ---------- CAST ---------- */
            .cast-row {
                list-style: none;
                margin: 0;
                padding: 0;
                display: grid;
                grid-auto-flow: column;
                grid-auto-columns: 7.5rem;
                gap: 0.75rem;
                overflow-x: auto;
                padding-bottom: 0.4rem;
                scrollbar-width: thin;
            }
            .cast-card {
                display: grid;
                gap: 0.4rem;
                background: var(--pico-card-sectioning-background-color);
                border-radius: var(--pico-border-radius);
                padding: 0.5rem;
            }
            .cast-photo {
                width: 100%;
                aspect-ratio: 2 / 3;
                object-fit: cover;
                border-radius: calc(var(--pico-border-radius) - 0.15rem);
                background: color-mix(in srgb, var(--pico-muted-color) 18%, transparent);
            }
            .cast-photo-fallback {
                display: grid;
                place-items: center;
                color: var(--pico-muted-color);
                font-size: 1.8rem;
                font-weight: 600;
                text-transform: uppercase;
            }
            .cast-name {
                margin: 0;
                font-size: 0.82rem;
                font-weight: 600;
                line-height: 1.2;
            }
            .cast-character {
                margin: 0;
                font-size: 0.75rem;
                color: var(--pico-muted-color);
                line-height: 1.2;
            }

            /* ---------- MISC ---------- */
            .error-panel,
            .loading-panel,
            .empty-panel {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 1.25rem;
            }
            .error-panel {
                color: var(--pico-del-color);
            }

            dialog::backdrop {
                background: color-mix(in srgb, black 55%, transparent);
            }

            @media (max-width: 720px) {
                :host {
                    width: 100%;
                }
                .hero-banner {
                    aspect-ratio: 16 / 7;
                }
                .hero-body {
                    grid-template-columns: minmax(0, 1fr);
                    margin-top: -5rem;
                    gap: 0.75rem;
                }
                .poster-shell {
                    max-width: 9rem;
                }
                .hero-copy {
                    padding-top: 0;
                }
                .headline-row {
                    grid-template-columns: minmax(0, 1fr);
                }
                .dist {
                    grid-template-columns: 7rem minmax(0, 1fr) 3rem;
                    font-size: 0.85rem;
                }
            }
        `,
    ];
}
