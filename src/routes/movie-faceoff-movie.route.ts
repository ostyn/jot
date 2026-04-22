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
    private isLoading = false;

    @state()
    private errorMessage = '';

    @state()
    private activeMethod?: MovieFaceoffRankingAlgorithm;

    @query('ranking-method-dialog')
    private methodDialog!: RankingMethodDialog;

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

    render() {
        const details = this.details;
        const storedMovie = this.storedMovie;
        const snapshots = this.snapshots;
        const chartSnapshots = getChartSnapshots(snapshots);

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
                          <movie-cast-row
                              .cast=${details?.credits?.cast || []}
                          ></movie-cast-row>
                      `
                    : nothing}
                ${!this.errorMessage && !this.isLoading && !details && !storedMovie
                    ? html`<article class="surface-panel empty-panel">
                          <p>No movie is selected.</p>
                      </article>`
                    : nothing}
            </main>
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

            @media (max-width: 720px) {
                :host {
                    width: 100%;
                }
            }
        `,
    ];
}
