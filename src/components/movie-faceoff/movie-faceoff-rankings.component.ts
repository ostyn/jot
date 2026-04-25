import { css, html, nothing, PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../../baseStyles';
import { movieFaceoffShared } from '../../movieFaceoffStyles';
import {
    MovieFaceoffRankedMovie,
    MovieFaceoffSortMode,
} from '../../interfaces/movie-faceoff.interface';
import { getMoviePosterUrl } from '../../services/movie-faceoff.service';
import { movieFaceoff } from '../../stores/movie-faceoff.store';
import {
    getMovieFaceoffRankingAlgorithm,
    getMovieFaceoffRankedMovies,
    MOVIE_FACEOFF_RANKING_ALGORITHMS,
} from '../../utils/movie-faceoff-rankings';
import '../jot-icon';
import './movie-list-item.component';

const INITIAL_VISIBLE = 50;
const LOAD_MORE_BATCH = 50;
const SENTINEL_ROOT_MARGIN = '400px';

@customElement('movie-faceoff-rankings')
export class MovieFaceoffRankings extends MobxLitElement {
    @property({ type: Boolean })
    isTargetedMode = false;

    @property({ attribute: false })
    sortMode: MovieFaceoffSortMode = 'elo';

    @state()
    private isExcludedOpen = false;

    @state()
    private visibleCount = INITIAL_VISIBLE;

    @query('dialog')
    private dialogRef!: HTMLDialogElement;

    @query('.list-sentinel')
    private sentinelRef?: HTMLElement;

    private sentinelObserver?: IntersectionObserver;
    private observedSentinel?: Element;

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

    private emit<T>(name: string, detail: T) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    private renderRankValue(movie: MovieFaceoffRankedMovie) {
        return this.rankingAlgorithm.formatMetric(movie);
    }

    connectedCallback() {
        super.connectedCallback();
        this.sentinelObserver = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) {
                    const total = this.rankedMovies.length;
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
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.sentinelObserver?.disconnect();
        this.sentinelObserver = undefined;
        this.observedSentinel = undefined;
    }

    willUpdate(changed: PropertyValues) {
        super.willUpdate(changed);
        if (changed.has('sortMode')) {
            this.visibleCount = INITIAL_VISIBLE;
        }
    }

    updated(changed: PropertyValues) {
        super.updated(changed);
        if (!this.sentinelObserver) return;
        const sentinel = this.sentinelRef;
        if (sentinel === this.observedSentinel) return;
        if (this.observedSentinel) this.sentinelObserver.unobserve(this.observedSentinel);
        if (sentinel) this.sentinelObserver.observe(sentinel);
        this.observedSentinel = sentinel;
    }

    render() {
        const ranked = this.rankedMovies;
        const visible = ranked.slice(0, this.visibleCount);
        const hasMore = visible.length < ranked.length;

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
                                ${MOVIE_FACEOFF_RANKING_ALGORITHMS.filter(
                                    (a) => !a.isAggregate && !a.isInformational
                                ).map(
                                    (algorithm) => html`
                                        <option value=${algorithm.id} ?selected=${algorithm.id === this.sortMode}>
                                            ${algorithm.label}
                                        </option>
                                    `
                                )}
                            </optgroup>
                            <optgroup label="Informational">
                                ${MOVIE_FACEOFF_RANKING_ALGORITHMS.filter((a) => a.isInformational).map(
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
                    ? html`<ol class="movie-list">
                          ${repeat(
                              visible,
                              (movie) => movie.id,
                              (movie, index) => {
                                  const posterUrl = movie.posterPath
                                      ? getMoviePosterUrl({
                                            poster_path: movie.posterPath,
                                        })
                                      : '';

                                  return html`
                                      <li>
                                          <movie-list-item
                                              layout="stacked"
                                              .posterUrl=${posterUrl}
                                              .title=${movie.title}
                                              .subtitle=${movie.releaseDate?.split('-')[0] ||
                                              'Unknown year'}
                                          >
                                              <strong slot="leading" class="rank-index"
                                                  >${index + 1}</strong
                                              >
                                              <strong slot="trailing" class="rank-score"
                                                  >${this.renderRankValue(movie)}</strong
                                              >
                                              <span slot="trailing" role="group">
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
                                                          this.emit('exclude-movie', { movie })}
                                                  >
                                                      <jot-icon name="XCircle"></jot-icon>
                                                  </button>
                                              </span>
                                          </movie-list-item>
                                      </li>
                                  `;
                              }
                          )}
                          ${hasMore
                              ? html`<li
                                    class="list-sentinel"
                                    aria-hidden="true"
                                ></li>`
                              : nothing}
                      </ol>`
                    : html`<article class="empty-state-panel">
                          <jot-icon name="TrendingUp" size="large"></jot-icon>
                          <p>Your rankings will appear here after a few faceoffs.</p>
                      </article>`}

                ${this.excludedMovies.length
                    ? html`
                          <details
                              ?open=${this.isExcludedOpen}
                              @toggle=${(e: Event) => {
                                  this.isExcludedOpen = (e.currentTarget as HTMLDetailsElement).open;
                              }}
                          >
                              <summary>Hidden (${this.excludedMovies.length})</summary>
                              ${this.isExcludedOpen
                                  ? html`<ul class="movie-list">
                                  ${repeat(
                                      this.excludedMovies,
                                      (movie) => movie.id,
                                      (movie) => {
                                          const posterUrl = movie.posterPath
                                              ? getMoviePosterUrl({ poster_path: movie.posterPath })
                                              : '';
                                          return html`
                                              <li>
                                                  <movie-list-item
                                                      .posterUrl=${posterUrl}
                                                      .title=${movie.title}
                                                      .subtitle=${'Hidden from the active pool'}
                                                  >
                                                      <button
                                                          slot="trailing"
                                                          class="secondary"
                                                          @click=${() =>
                                                              this.emit('restore-excluded', {
                                                                  movie,
                                                              })}
                                                      >
                                                          Restore
                                                      </button>
                                                  </movie-list-item>
                                              </li>
                                          `;
                                      }
                                  )}
                              </ul>`
                                  : nothing}
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
            .rankings-controls select,
            .rankings-controls button {
                margin: 0;
            }
            .rankings-controls .info-button {
                flex: 0 0 3rem;
                width: 3rem;
                padding: 0;
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
            .hide-button {
                color: var(--pico-del-color);
                border-color: var(--pico-del-color);
                padding: 0.25rem;
                margin: 0;
            }
            .rank-score {
                font-variant-numeric: tabular-nums;
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
