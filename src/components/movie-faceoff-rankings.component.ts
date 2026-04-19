import { css, html, nothing } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { movieFaceoffShared } from '../movieFaceoffStyles';
import {
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../interfaces/movie-faceoff.interface';
import { getMoviePosterUrl } from '../services/movie-faceoff.service';
import { movieFaceoff } from '../stores/movie-faceoff.store';
import {
    getMovieFaceoffRankingAlgorithm,
    getMovieFaceoffRankedMovies,
    MOVIE_FACEOFF_RANKING_ALGORITHMS,
} from '../utils/movie-faceoff-rankings';
import './jot-icon';

@customElement('movie-faceoff-rankings')
export class MovieFaceoffRankings extends MobxLitElement {
    @property({ type: Boolean })
    isTargetedMode = false;

    @property({ attribute: false })
    sortMode: MovieFaceoffSortMode = 'elo';

    @query('dialog')
    private dialogRef!: HTMLDialogElement;

    private get replayState() {
        return movieFaceoff.replayState;
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

    private renderRankValue(movie: MovieFaceoffRankedMovie) {
        return this.rankingAlgorithm.formatMetric(movie);
    }

    render() {
        const ranked = this.rankedMovies;

        return html`
            <article class="rankings-panel surface-panel">
                <header class="panel-header">
                    <hgroup class="rankings-heading">
                        <p class="eyebrow">Live leaderboard</p>
                        <h2>Rankings</h2>
                        <p class="text-muted">
                            ${ranked.length
                                ? `${ranked.length} movies ranked so far`
                                : 'Vote a few times to start building your list.'}
                        </p>
                    </hgroup>
                </header>

                <div class="rankings-controls" role="group">
                    <select
                            ?disabled=${this.isTargetedMode}
                            @change=${(event: Event) => {
                                const sortMode = (event.currentTarget as HTMLSelectElement).value as MovieFaceoffSortMode;
                                this.emit('sort-change', { sortMode });
                            }}
                        >
                            <optgroup label="Combined">
                                ${MOVIE_FACEOFF_RANKING_ALGORITHMS.filter((a) => a.isAggregate).map(
                                    (algorithm) => html`
                                        <option value=${algorithm.id} ?selected=${algorithm.id === this.sortMode}>
                                            ${algorithm.label}
                                        </option>
                                    `
                                )}
                            </optgroup>
                            <optgroup label="Individual">
                                ${MOVIE_FACEOFF_RANKING_ALGORITHMS.filter((a) => !a.isAggregate).map(
                                    (algorithm) => html`
                                        <option value=${algorithm.id} ?selected=${algorithm.id === this.sortMode}>
                                            ${algorithm.label}
                                        </option>
                                    `
                                )}
                            </optgroup>
                    </select>
                    <button
                        class="outline info-button"
                        aria-label="About the current ranking method"
                        @click=${() => {
                            this.dialogRef.showModal();
                        }}
                    >
                        <jot-icon name="Info"></jot-icon>
                    </button>
                </div>

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
                                                  <span role="group">
                                                      <button
                                                          class="outline"
                                                          @click=${() =>
                                                              this.emit('navigate-movie', {
                                                                  movieId: movie.id,
                                                              })}
                                                      >
                                                          Details
                                                      </button>
                                                      <button
                                                          class="outline hide-button"
                                                          aria-label=${`Hide ${movie.title}`}
                                                          @click=${() =>
                                                              this.emit('exclude-movie', {
                                                                  movie,
                                                              })}
                                                      >
                                                          <jot-icon name="XCircle"></jot-icon>
                                                      </button>
                                                  </span>
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

                ${this.excludedMovies.length
                    ? html`
                          <details>
                              <summary>Hidden (${this.excludedMovies.length})</summary>
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
                          </details>
                      `
                    : nothing}

                ${this.unseenMovies.length
                    ? html`
                          <details>
                              <summary>Not seen (${this.unseenMovies.length})</summary>
                              <ul class="excluded-list">
                                  ${this.unseenMovies.map((movie) => {
                                      const posterUrl = movie.posterPath
                                          ? getMoviePosterUrl({ poster_path: movie.posterPath })
                                          : '';
                                      return html`
                                          <li class="rank-row rank-row--no-index">
                                              <span class="rank-poster" aria-hidden="true">
                                                  ${posterUrl
                                                      ? html`<img src=${posterUrl} alt="" loading="lazy" />`
                                                      : html`<span class="rank-poster-fallback">
                                                            <jot-icon name="Play"></jot-icon>
                                                        </span>`}
                                              </span>
                                              <span class="rank-item">
                                                  <span class="rank-title-group">
                                                      <strong>${movie.title}</strong>
                                                      <small class="rank-subtitle">${movie.releaseDate?.split('-')[0] || 'Unknown year'}</small>
                                                  </span>
                                                  <span class="rank-meta">
                                                      <button
                                                          class="outline"
                                                          @click=${() => this.emit('navigate-movie', { movieId: movie.id })}
                                                      >
                                                          Details
                                                      </button>
                                                  </span>
                                              </span>
                                          </li>
                                      `;
                                  })}
                              </ul>
                          </details>
                      `
                    : nothing}
            </article>
            <dialog @click=${(e: Event) => {
                if ((e.target as Element).nodeName === 'DIALOG') (e.target as HTMLDialogElement).close();
            }}>
                <article>
                    <header>
                        <p class="eyebrow">Current ranking method</p>
                        <h3>${this.rankingAlgorithm.label}</h3>
                    </header>
                    ${this.rankingAlgorithm.description
                        .split('\n\n')
                        .filter(Boolean)
                        .map((paragraph) => html`<p>${paragraph}</p>`)}
                    <footer>
                        <button @click=${() => this.dialogRef.close()}>Close</button>
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
            .panel-header {
                position: relative;
                z-index: 1;
            }
            .rank-subtitle,
            .excluded-copy small {
                margin: 0;
                color: var(--pico-muted-color);
            }
            .rankings-controls select,
            .rankings-controls button {
                margin: 0;
            }
            .rankings-controls .info-button {
                flex: 0 0 3rem;
                width: 3rem;
                padding: 0;
            }
            .rank-item,
            .rank-title-group {
                min-width: 0;
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
            .rank-row--no-index {
                grid-template-columns: 4rem minmax(0, 1fr);
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
                flex-direction: column;
                gap: 0.5rem;
                text-align: left;
            }
            .rank-title-group {
                display: flex;
                flex-direction: column;
                gap: 0.16rem;
            }
            .hide-button {
                color: var(--pico-del-color);
                border-color: var(--pico-del-color);
                padding: 0.25rem;
                margin: 0;
            }
            .rank-meta {
                display: flex;
                gap: 0.5rem;
                align-items: center;
                flex-wrap: wrap;
                justify-content: space-between;
            }
            .rank-score {
                font-variant-numeric: tabular-nums;
            }
            .excluded-list {
                margin: 0;
                padding: 0;
                list-style: none;
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
            dialog::backdrop {
                background: color-mix(in srgb, black 55%, transparent);
            }
            @media (max-width: 640px) {
                .excluded-item {
                    padding: 0.5rem 0.65rem;
                }
                .rank-row {
                    grid-template-columns: auto 3rem minmax(0, 1fr);
                    padding: 0.65rem 0.7rem;
                }
                .rank-row--no-index {
                    grid-template-columns: 3rem minmax(0, 1fr);
                }
                .rank-poster {
                    width: 3rem;
                }
            }
        `,
    ];
}
