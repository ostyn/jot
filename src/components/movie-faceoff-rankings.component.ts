import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import {
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';
import { getMoviePosterUrl } from '../services/movie-faceoff.service';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import {
    buildMovieFaceoffReplayState,
    getMovieFaceoffRankingAlgorithm,
    getMovieFaceoffRankedMovies,
    MOVIE_FACEOFF_RANKING_ALGORITHMS,
    MovieFaceoffReplayState,
} from '../utils/movie-faceoff-rankings';
import './jot-icon';

@customElement('movie-faceoff-rankings')
export class MovieFaceoffRankings extends MobxLitElement {
    @property({ type: Boolean })
    isTargetedMode = false;

    @state()
    private sortMode: MovieFaceoffSortMode = 'elo';

    @state()
    private editList = false;

    @state()
    private showAlgorithmInfo = false;

    private cachedReplayState: MovieFaceoffReplayState | null = null;
    private cachedReplayStateVersion = 0;

    private get replayState() {
        const currentVersion = movieFaceoff.allEvents.length + movieFaceoff.allMovies.length;
        if (!this.cachedReplayState || this.cachedReplayStateVersion !== currentVersion) {
            this.cachedReplayState = buildMovieFaceoffReplayState(
                movieFaceoff.allEvents,
                movieFaceoff.allMovies
            );
            this.cachedReplayStateVersion = currentVersion;
        }
        return this.cachedReplayState;
    }

    private get rankingAlgorithm() {
        return getMovieFaceoffRankingAlgorithm(this.sortMode);
    }

    private get rankedMovies() {
        return getMovieFaceoffRankedMovies(this.replayState, this.sortMode).filter(
            (movie) => !movie.excludedAt && !movie.unseenAt
        );
    }

    private get excludedMovies() {
        return [...movieFaceoff.allMovies]
            .filter((movie) => movie.excludedAt)
            .sort((a, b) => a.title.localeCompare(b.title) || b.updatedAt.localeCompare(a.updatedAt));
    }

    private get unseenMovies() {
        return [...movieFaceoff.allMovies]
            .filter((movie) => movie.unseenAt)
            .sort((a, b) => a.title.localeCompare(b.title) || b.updatedAt.localeCompare(a.updatedAt));
    }

    private emit<T>(name: string, detail: T) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    private handleKeyDown = (event: KeyboardEvent) => {
        if (this.showAlgorithmInfo && event.key === 'Escape') {
            event.preventDefault();
            this.showAlgorithmInfo = false;
        }
    };

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener('keydown', this.handleKeyDown);
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this.handleKeyDown);
        this.cachedReplayState = null;
        this.cachedReplayStateVersion = 0;
        super.disconnectedCallback();
    }

    private renderRankValue(movie: MovieFaceoffRankedMovie) {
        return this.rankingAlgorithm.formatMetric(movie);
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
        const ranked = this.rankedMovies;

        return html`
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
                                    this.sortMode = (event.currentTarget as HTMLSelectElement).value as MovieFaceoffSortMode;
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
                                                          this.emit('navigate-movie', {
                                                              movieId: movie.id,
                                                          })}
                                                  >
                                                      Details
                                                  </button>
                                                  ${this.editList
                                                      ? html`<button
                                                            class="outline delete-button"
                                                            @click=${() =>
                                                                this.emit('exclude-movie', {
                                                                    movie,
                                                                })}
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
                                                      this.emit('restore-excluded', {
                                                          movie,
                                                      })}
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
                                                      this.emit('restore-seen', {
                                                          movie,
                                                      })}
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
            ${this.renderAlgorithmInfoModal()}
        `;
    }

    static styles = [
        base,
        css`
            :host {
                display: block;
                min-width: 0;
            }
            .surface-panel {
                position: relative;
                overflow: hidden;
                margin: 0;
            }
            .surface-panel > * {
                position: relative;
                z-index: 1;
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
            .list-section-header h3 {
                margin: 0;
            }
            .eyebrow {
                margin: 0 0 0.2rem;
                color: var(--pico-muted-color);
                font-size: 0.78rem;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }
            .panel-description,
            .rank-subtitle,
            .excluded-copy small {
                margin: 0;
                color: var(--pico-muted-color);
            }
            .rankings-actions {
                display: flex;
                gap: 0.75rem;
                align-items: end;
                margin-left: auto;
                flex-wrap: wrap;
                justify-content: flex-end;
            }
            .rankings-actions,
            .ranking-select-field,
            .rank-item,
            .rank-title-group {
                min-width: 0;
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
            .empty-state-panel {
                display: grid;
                gap: 0.85rem;
                place-items: center;
                text-align: center;
                margin: 0;
            }
            .empty-state-panel p {
                margin: 0;
                color: var(--pico-muted-color);
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
            @media (max-width: 640px) {
                .rankings-actions {
                    flex-direction: column;
                    align-items: stretch;
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
                .ranking-select-field select {
                    width: 100%;
                }
            }
        `,
    ];
}
