import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation, WebComponentInterface } from '@vaadin/router';
import { base } from '../baseStyles';
import '../components/jot-icon';
import '../components/utility-page-header.component';
import {
    FaceoffMovieDetails,
    fetchTmdbMovieDetails,
    getMovieBackdropUrl,
    getMoviePosterUrl,
} from '../services/movie-faceoff.service';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import {
    buildMovieFaceoffReplayState,
    MOVIE_FACEOFF_RANKING_ALGORITHMS,
} from '../utils/movie-faceoff-rankings';

type RankingSnapshot = {
    id: string;
    label: string;
    rank: number | null;
    total: number;
    metric: string;
};

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

    async onAfterEnter(location: RouterLocation) {
        const rawId = Number(location.params.id);
        if (!Number.isFinite(rawId) || rawId <= 0) {
            this.movieId = undefined;
            this.details = undefined;
            this.errorMessage = 'That movie page could not be found.';
            return;
        }

        this.movieId = rawId;
        await this.loadMovie();
    }

    private get replayState() {
        return buildMovieFaceoffReplayState(
            movieFaceoff.allEvents,
            movieFaceoff.allMovies
        );
    }

    private get rankingSnapshots(): RankingSnapshot[] {
        const movieId = this.movieId;
        if (!movieId) return [];

        return MOVIE_FACEOFF_RANKING_ALGORITHMS.map((algorithm) => {
            const ranked = algorithm
                .rank(this.replayState)
                .filter((movie) => !movie.excludedAt && !movie.unseenAt);
            const index = ranked.findIndex((movie) => movie.id === movieId);
            const rankedMovie = index === -1 ? undefined : ranked[index];

            return {
                id: algorithm.id,
                label: algorithm.label,
                rank: index === -1 ? null : index + 1,
                total: ranked.length,
                metric: rankedMovie ? algorithm.formatMetric(rankedMovie) : 'Not ranked yet',
            };
        });
    }

    private get storedMovie() {
        if (!this.movieId) return undefined;
        return movieFaceoff.movieMap.get(this.movieId);
    }

    private get primaryRanking() {
        return this.rankingSnapshots.find((ranking) => ranking.rank !== null);
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
        if (!runtime) return 'Unknown';
        const hours = Math.floor(runtime / 60);
        const minutes = runtime % 60;
        if (!hours) return `${minutes}m`;
        if (!minutes) return `${hours}h`;
        return `${hours}h ${minutes}m`;
    }

    private formatVoteAverage(voteAverage?: number, voteCount?: number) {
        if (!voteAverage) return 'No TMDB rating yet';
        const score = voteAverage.toFixed(1);
        if (!voteCount) return `${score}/10 on TMDB`;
        return `${score}/10 on TMDB (${voteCount.toLocaleString()} votes)`;
    }

    private renderStat(label: string, value: string) {
        return html`
            <article class="stat-card">
                <p>${label}</p>
                <strong>${value}</strong>
            </article>
        `;
    }

    render() {
        const details = this.details;
        const storedMovie = this.storedMovie;
        const title = details?.title || storedMovie?.title || 'Movie';
        const posterUrl = getMoviePosterUrl(details || { poster_path: storedMovie?.posterPath });
        const backdropUrl = getMovieBackdropUrl(details || { backdrop_path: undefined });
        const year = (details?.release_date || storedMovie?.releaseDate || '').split('-')[0];
        const genres = details?.genres?.map((genre) => genre.name).join(', ') || 'Unknown';
        const primaryRanking = this.primaryRanking;

        return html`
            <utility-page-header
                title=${title}
                backHref="/movie-faceoff"
                backLabel="Movie Faceoff"
            ></utility-page-header>
            <main class="layout">
                ${this.errorMessage
                    ? html`<article class="surface-panel error-panel">
                          <jot-icon name="AlertTriangle"></jot-icon>
                          <p>${this.errorMessage}</p>
                      </article>`
                    : nothing}

                ${this.isLoading
                    ? html`<article class="surface-panel loading-panel">
                          <p>Loading movie details...</p>
                      </article>`
                    : nothing}

                ${details || storedMovie
                    ? html`
                          <section class="hero surface-panel">
                              <div
                                  class="hero-backdrop ${backdropUrl ? 'has-image' : ''}"
                                  style=${backdropUrl
                                      ? `background-image:url(${backdropUrl});`
                                      : ''}
                              ></div>
                              <div class="hero-content">
                                  <div class="poster-shell">
                                      ${posterUrl
                                          ? html`<img
                                                class="poster"
                                                src=${posterUrl}
                                                alt=${title}
                                            />`
                                          : html`<div class="poster poster-fallback">
                                                <jot-icon
                                                    name="Play"
                                                    size="xlarge"
                                                ></jot-icon>
                                            </div>`}
                                  </div>
                                  <div class="hero-copy">
                                      <p class="eyebrow">Movie Faceoff</p>
                                      <h2>${title}${year ? html` <span>(${year})</span>` : nothing}</h2>
                                      ${details?.tagline
                                          ? html`<p class="tagline">${details.tagline}</p>`
                                          : nothing}
                                      <p class="summary">
                                          ${details?.overview ||
                                          'No plot summary is available for this movie yet.'}
                                      </p>
                                      <div class="pill-row">
                                          <span>${this.formatDate(details?.release_date || storedMovie?.releaseDate)}</span>
                                          <span>${this.formatRuntime(details?.runtime)}</span>
                                          <span>${genres}</span>
                                          <span>${this.formatVoteAverage(
                                              details?.vote_average,
                                              details?.vote_count
                                          )}</span>
                                      </div>
                                      <dl class="hero-facts-grid">
                                          <div>
                                              <dt>Original title</dt>
                                              <dd>${details?.original_title || title}</dd>
                                          </div>
                                          <div>
                                              <dt>Status</dt>
                                              <dd>${details?.status || 'Unknown'}</dd>
                                          </div>
                                          <div>
                                              <dt>Language</dt>
                                              <dd>
                                                  ${(details?.original_language || 'unknown').toUpperCase()}
                                              </dd>
                                          </div>
                                          <div>
                                              <dt>Tracked since</dt>
                                              <dd>
                                                  ${storedMovie
                                                      ? this.formatDate(storedMovie.createdAt)
                                                      : 'Not saved yet'}
                                              </dd>
                                          </div>
                                      </dl>
                                  </div>
                              </div>
                          </section>

                          <section class="detail-stack">
                              <article class="surface-panel section-card rankings-card">
                                  <header class="section-header">
                                      <div>
                                          <p class="eyebrow">Ranking snapshot</p>
                                          <h3>Compare rankings</h3>
                                      </div>
                                      ${primaryRanking
                                          ? html`<strong class="headline-rank"
                                                >#${primaryRanking.rank}</strong
                                            >`
                                          : html`<strong class="headline-rank muted"
                                                >Unranked</strong
                                            >`}
                                  </header>

                                  <div class="stats-grid">
                                      ${this.renderStat(
                                          'Votes won',
                                          String(
                                              this.replayState.ratings.get(this.movieId || 0)
                                                  ?.winCount || 0
                                          )
                                      )}
                                      ${this.renderStat(
                                          'Votes lost',
                                          String(
                                              this.replayState.ratings.get(this.movieId || 0)
                                                  ?.lossCount || 0
                                          )
                                      )}
                                      ${this.renderStat(
                                          'Elo rating',
                                          `${Math.round(
                                              this.replayState.ratings.get(this.movieId || 0)
                                                  ?.rating || 1500
                                          )}`
                                      )}
                                      ${this.renderStat(
                                          'Tracked since',
                                          storedMovie
                                              ? this.formatDate(storedMovie.createdAt)
                                              : 'Not saved yet'
                                      )}
                                  </div>

                                  <div class="ranking-compare-grid">
                                      ${this.rankingSnapshots.map(
                                          (ranking) => html`
                                              <article class="ranking-cell">
                                                  <span class="ranking-label">
                                                      ${ranking.label}
                                                  </span>
                                                  <strong class="ranking-position">
                                                      ${ranking.rank === null
                                                          ? 'Unranked'
                                                          : `#${ranking.rank}`}
                                                  </strong>
                                                  <small class="ranking-total">
                                                      ${ranking.rank === null
                                                          ? 'Not placed in this list'
                                                          : `of ${ranking.total}`}
                                                  </small>
                                                  <span class="ranking-copy">
                                                      <small>${ranking.metric || 'No metric'}</small>
                                                  </span>
                                              </article>
                                          `
                                      )}
                                  </div>
                              </article>
                          </section>
                      `
                    : nothing}

                ${!this.errorMessage && !this.isLoading && !details && !storedMovie
                    ? html`<article class="surface-panel empty-panel">
                          <p>No movie is selected.</p>
                      </article>`
                    : nothing}
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
            }
            .surface-panel {
                position: relative;
                overflow: hidden;
                margin: 0;
            }
            .hero {
                min-height: 24rem;
            }
            .hero-backdrop {
                position: absolute;
                inset: 0;
                background:
                    linear-gradient(
                        180deg,
                        color-mix(in srgb, black 10%, transparent),
                        color-mix(in srgb, var(--pico-card-background-color) 94%, transparent)
                    ),
                    color-mix(
                        in srgb,
                        var(--pico-card-sectioning-background-color) 75%,
                        var(--pico-card-background-color)
                    );
                background-size: cover;
                background-position: center;
                opacity: 0.28;
                filter: blur(8px);
                transform: scale(1.03);
            }
            .hero-content,
            .section-card {
                position: relative;
                z-index: 1;
            }
            .hero-content {
                display: grid;
                grid-template-columns: 14rem minmax(0, 1fr);
                gap: 1.25rem;
                align-items: end;
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
            }
            .poster-fallback {
                display: grid;
                place-items: center;
            }
            .hero-copy,
            .ranking-copy {
                min-width: 0;
            }
            .hero-copy h2,
            .section-header h3 {
                margin: 0;
            }
            .hero-copy h2 span {
                color: var(--pico-muted-color);
                font-weight: 500;
            }
            .eyebrow {
                margin: 0 0 0.25rem;
                color: var(--pico-muted-color);
                font-size: 0.78rem;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }
            .tagline,
            .summary,
            .ranking-copy small,
            dt {
                color: var(--pico-muted-color);
            }
            .tagline {
                margin: 0.5rem 0 0;
                font-style: italic;
            }
            .summary {
                margin: 1rem 0 0;
                font-size: 1.02rem;
                line-height: 1.6;
                white-space: pre-wrap;
            }
            .pill-row {
                display: flex;
                flex-wrap: wrap;
                gap: 0.65rem;
                margin-top: 1rem;
            }
            .pill-row span {
                padding: 0.45rem 0.7rem;
                border-radius: 999px;
                background: color-mix(
                    in srgb,
                    var(--pico-card-sectioning-background-color) 82%,
                    var(--pico-card-background-color)
                );
                font-size: 0.92rem;
            }
            .hero-facts-grid {
                display: grid;
                gap: 0.75rem 1rem;
                grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
                margin: 1rem 0 0;
            }
            .detail-stack {
                display: grid;
                gap: 1rem;
            }
            .section-card {
                display: grid;
                gap: 1rem;
            }
            .rankings-card {
                gap: 1.1rem;
            }
            .section-header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .headline-rank {
                font-size: 1.5rem;
                line-height: 1;
            }
            .headline-rank.muted {
                color: var(--pico-muted-color);
                font-size: 1rem;
            }
            .stats-grid {
                display: grid;
                gap: 0.75rem;
                grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
            }
            .stat-card {
                display: grid;
                gap: 0.35rem;
                margin: 0;
                padding: 0.85rem 1rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .stat-card p,
            dd {
                margin: 0;
            }
            .ranking-compare-grid {
                display: grid;
                gap: 0.75rem;
                grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
            }
            .ranking-cell {
                display: grid;
                gap: 0.18rem;
                padding: 0.85rem 1rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .ranking-label {
                font-size: 0.86rem;
                color: var(--pico-muted-color);
            }
            .ranking-position {
                white-space: nowrap;
                font-size: 1.2rem;
                line-height: 1.1;
            }
            .ranking-total {
                color: var(--pico-muted-color);
            }
            dt {
                margin: 0 0 0.2rem;
                font-size: 0.85rem;
            }
            .error-panel,
            .loading-panel,
            .empty-panel {
                display: flex;
                align-items: center;
                gap: 0.75rem;
            }
            .error-panel {
                color: var(--pico-del-color);
            }
            @media (max-width: 800px) {
                :host {
                    width: 100%;
                }
                .hero-content {
                    grid-template-columns: minmax(0, 1fr);
                }
                .poster-shell {
                    max-width: 12rem;
                }
            }
        `,
    ];
}
