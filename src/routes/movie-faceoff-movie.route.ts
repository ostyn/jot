import { css, html, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation, WebComponentInterface } from '@vaadin/router';
import { base } from '../baseStyles';
import '../components/jot-icon';
import '../components/movie-faceoff/movie-cast-row.component';
import '../components/movie-faceoff/movie-hero.component';
import '../components/movie-faceoff/movie-rank-chart.component';
import '../components/movie-faceoff/movie-ranking-analysis.component';
import '../components/movie-faceoff/movie-vote-stats.component';
import '../components/movie-faceoff/ranking-method-dialog.component';
import { RankingMethodDialog } from '../components/movie-faceoff/ranking-method-dialog.component';
import '../components/utility-page-header.component';
import {
    FaceoffMovieDetails,
    fetchTmdbMovieDetails,
} from '../services/movie-faceoff.service';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import { MovieFaceoffRankingAlgorithm } from '../utils/movie-faceoff-rankings';
import {
    buildRankingSnapshots,
    computeRankRange,
    getChartSnapshots,
    getHeadlineSnapshot,
    getUncertaintySnapshot,
} from '../utils/movie-ranking-snapshots';
import { betterGo } from './route-config';

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
    private isLoading = true;

    @state()
    private errorMessage = '';

    @state()
    private activeMethod?: MovieFaceoffRankingAlgorithm;

    @query('ranking-method-dialog')
    private methodDialog!: RankingMethodDialog;

    async onAfterEnter(location: RouterLocation) {
        this.isLoading = true;
        const rawId = Number(location.params.id);
        if (!Number.isFinite(rawId) || rawId <= 0) {
            this.movieId = undefined;
            this.details = undefined;
            this.errorMessage = 'That movie page could not be found.';
            this.isLoading = false;
            return;
        }

        this.movieId = rawId;
        await Promise.all([movieFaceoff.ensureLoaded(), this.loadMovie()]);
    }

    private get storedMovie() {
        if (!this.movieId) return undefined;
        return movieFaceoff.movieMap.get(this.movieId);
    }

    private get rating() {
        return movieFaceoff.replayState.ratings.get(this.movieId || 0);
    }

    private get snapshots() {
        if (!this.movieId) return [];
        return buildRankingSnapshots(this.movieId, movieFaceoff.replayState);
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

    private onMethodClick(
        event: CustomEvent<{ algorithm: MovieFaceoffRankingAlgorithm }>
    ) {
        this.activeMethod = event.detail.algorithm;
        this.updateComplete.then(() => this.methodDialog.show());
    }

    private renderBody() {
        if (this.errorMessage) {
            return html`<article class="surface-panel error-panel">
                <jot-icon name="AlertTriangle"></jot-icon>
                <p>${this.errorMessage}</p>
            </article>`;
        }

        const details = this.details;
        const storedMovie = this.storedMovie;
        if (details || storedMovie) {
            const snapshots = this.snapshots;
            const chartSnapshots = getChartSnapshots(snapshots);
            return html`
                <movie-hero
                    .details=${details}
                    .storedMovie=${storedMovie}
                ></movie-hero>
                <movie-ranking-analysis
                    .headline=${getHeadlineSnapshot(chartSnapshots)}
                    .uncertainty=${getUncertaintySnapshot(snapshots)}
                    .rankRange=${computeRankRange(chartSnapshots)}
                ></movie-ranking-analysis>
                <movie-rank-chart
                    .snapshots=${chartSnapshots}
                    @method-click=${this.onMethodClick}
                ></movie-rank-chart>
                <movie-vote-stats .rating=${this.rating}></movie-vote-stats>
                <movie-cast-row .cast=${details?.credits?.cast || []}></movie-cast-row>
            `;
        }

        if (this.isLoading) {
            return html`<div
                class="movie-skeleton"
                aria-busy="true"
                aria-label="Loading movie details"
            >
                <div class="skeleton-hero">
                    <div class="skeleton-block skeleton-poster"></div>
                    <div class="skeleton-text">
                        <div class="skeleton-block skeleton-line skeleton-line-title"></div>
                        <div class="skeleton-block skeleton-line skeleton-line-sub"></div>
                        <div class="skeleton-block skeleton-line"></div>
                        <div class="skeleton-block skeleton-line skeleton-line-short"></div>
                    </div>
                </div>
                <div class="skeleton-block skeleton-chart"></div>
            </div>`;
        }

        return html`<article class="surface-panel empty-panel">
            <p>No movie is selected.</p>
        </article>`;
    }

    render() {
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
            <main class="layout">${this.renderBody()}</main>
            <ranking-method-dialog .method=${this.activeMethod}></ranking-method-dialog>
        `;
    }

    static styles = [
        base,
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
            .error-panel,
            .empty-panel {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                padding: 1.25rem;
            }
            .error-panel {
                color: var(--pico-del-color);
            }

            .movie-skeleton {
                display: grid;
                gap: 1rem;
            }
            .skeleton-hero {
                display: grid;
                grid-template-columns: minmax(140px, 220px) 1fr;
                gap: 1.25rem;
                padding: 1rem;
                background: var(--pico-card-background-color);
                border-radius: var(--pico-border-radius);
            }
            .skeleton-text {
                display: grid;
                gap: 0.75rem;
                align-content: start;
                padding-block: 0.5rem;
            }
            .skeleton-block {
                background: linear-gradient(
                    90deg,
                    color-mix(in srgb, var(--pico-muted-color) 12%, transparent),
                    color-mix(in srgb, var(--pico-muted-color) 22%, transparent),
                    color-mix(in srgb, var(--pico-muted-color) 12%, transparent)
                );
                background-size: 200% 100%;
                border-radius: var(--pico-border-radius);
                animation: skeleton-shimmer 1.4s ease-in-out infinite;
            }
            .skeleton-poster {
                aspect-ratio: 2 / 3;
                width: 100%;
            }
            .skeleton-line {
                height: 0.95rem;
            }
            .skeleton-line-title {
                height: 1.6rem;
                width: 70%;
            }
            .skeleton-line-sub {
                width: 45%;
            }
            .skeleton-line-short {
                width: 60%;
            }
            .skeleton-chart {
                height: 220px;
            }
            @keyframes skeleton-shimmer {
                0% {
                    background-position: 100% 0;
                }
                100% {
                    background-position: -100% 0;
                }
            }
            @media (prefers-reduced-motion: reduce) {
                .skeleton-block {
                    animation: none;
                }
            }

            @media (max-width: 720px) {
                :host {
                    width: 100%;
                }
            }
        `,
    ];
}
