import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import '../components/jot-icon';
import '../components/utility-page-header.component';
import {
    FaceoffMovie,
    getMoviePosterUrl,
    searchTmdbMovies,
} from '../services/movie-faceoff.service';
import { betterGo } from './route-config';

@customElement('movie-faceoff-add-route')
export class MovieFaceoffAddRoute extends MobxLitElement {
    @state()
    private searchQuery = '';

    @state()
    private searchResults: FaceoffMovie[] = [];

    @state()
    private searchErrorMessage = '';

    @state()
    private isSearching = false;

    private getMovieYear(movie: Pick<FaceoffMovie, 'release_date'>) {
        return movie.release_date?.split('-')[0] || 'Unknown year';
    }

    private async handleMovieSearch(event?: Event) {
        event?.preventDefault();
        const trimmedQuery = this.searchQuery.trim();
        this.searchErrorMessage = '';
        this.searchResults = [];

        if (!trimmedQuery) {
            this.searchErrorMessage = 'Enter a movie title to search TMDB.';
            return;
        }

        this.isSearching = true;
        try {
            const results = await searchTmdbMovies(trimmedQuery);
            this.searchResults = results.slice(0, 10);
            if (!this.searchResults.length) {
                this.searchErrorMessage = `No TMDB results found for "${trimmedQuery}".`;
            }
        } catch (error) {
            this.searchErrorMessage =
                error instanceof Error ? error.message : 'Unable to search movies.';
        } finally {
            this.isSearching = false;
        }
    }

    private selectMovie(movie: FaceoffMovie) {
        betterGo('movie-faceoff', {
            queryParams: {
                targetMovieId: movie.id,
            },
        });
    }

    render() {
        return html`
            <utility-page-header
                title="Add Movie"
                backHref="/movie-faceoff"
                backLabel="Movie Faceoff"
            ></utility-page-header>
            <main class="layout">
                <section class="surface-panel search-panel">
                    <header class="panel-header">
                        <div>
                            <p class="eyebrow">Targeted placement</p>
                            <h2>Search for a movie to add</h2>
                        </div>
                        <p class="panel-description">
                            Pick a movie and we’ll send it back to Movie Faceoff to
                            place it against key ranked movies.
                        </p>
                    </header>

                    <form
                        class="search-form"
                        @submit=${(event: Event) => {
                            void this.handleMovieSearch(event);
                        }}
                    >
                        <input
                            type="search"
                            .value=${this.searchQuery}
                            placeholder="Search for a movie title"
                            ?disabled=${this.isSearching}
                            @input=${(event: InputEvent) => {
                                this.searchQuery = (
                                    event.currentTarget as HTMLInputElement
                                ).value;
                                this.searchErrorMessage = '';
                            }}
                        />
                        <button type="submit" ?aria-busy=${this.isSearching}>
                            <jot-icon name="Search"></jot-icon>
                            ${this.isSearching ? 'Searching...' : 'Search'}
                        </button>
                    </form>

                    ${this.searchErrorMessage
                        ? html`<p class="search-feedback error">
                              ${this.searchErrorMessage}
                          </p>`
                        : nothing}

                    ${this.searchResults.length
                        ? html`
                              <ul class="search-results-list">
                                  ${this.searchResults.map((movie) => {
                                      const posterUrl = getMoviePosterUrl(movie);
                                      return html`
                                          <li>
                                              <button
                                                  class="search-result"
                                                  @click=${() => {
                                                      this.selectMovie(movie);
                                                  }}
                                              >
                                                  <span class="search-result-poster">
                                                      ${posterUrl
                                                          ? html`<img
                                                                src=${posterUrl}
                                                                alt=""
                                                                loading="lazy"
                                                            />`
                                                          : html`<span
                                                                class="search-result-poster-fallback"
                                                            >
                                                                <jot-icon name="Play"></jot-icon>
                                                            </span>`}
                                                  </span>
                                                  <span class="search-result-copy">
                                                      <strong>${movie.title}</strong>
                                                      <small>${this.getMovieYear(movie)}</small>
                                                  </span>
                                                  <span class="search-result-action">
                                                      Start placement
                                                  </span>
                                              </button>
                                          </li>
                                      `;
                                  })}
                              </ul>
                          `
                        : nothing}
                </section>
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
                width: min(100%, 72rem);
                margin-inline: auto;
            }
            .layout {
                display: grid;
                gap: 1rem;
            }
            .surface-panel {
                margin: 0;
            }
            .search-panel {
                display: grid;
                gap: 1rem;
            }
            .panel-header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .panel-header h2 {
                margin: 0;
            }
            .eyebrow {
                margin: 0 0 0.25rem;
                color: var(--pico-muted-color);
                font-size: 0.78rem;
                letter-spacing: 0.06em;
                text-transform: uppercase;
            }
            .panel-description,
            .search-feedback,
            .search-result-copy small {
                margin: 0;
                color: var(--pico-muted-color);
            }
            .search-form {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 0.75rem;
                align-items: center;
            }
            .search-form input,
            .search-form button {
                margin: 0;
            }
            .search-feedback.error {
                color: var(--pico-del-color);
            }
            .search-results-list {
                list-style: none;
                padding: 0;
                margin: 0;
                display: flex;
                flex-direction: column;
                gap: 0.65rem;
            }
            .search-result {
                width: 100%;
                display: grid;
                grid-template-columns: 3rem minmax(0, 1fr) auto;
                gap: 0.75rem;
                align-items: center;
                padding: 0.75rem 0.85rem;
                text-align: left;
            }
            .search-result-poster {
                width: 3rem;
                aspect-ratio: 2 / 3;
                overflow: hidden;
                border-radius: calc(var(--pico-border-radius) * 0.8);
                background: var(--pico-form-element-background-color);
                display: block;
            }
            .search-result-poster img,
            .search-result-poster-fallback {
                width: 100%;
                height: 100%;
                display: block;
            }
            .search-result-poster img {
                object-fit: cover;
            }
            .search-result-poster-fallback {
                display: grid;
                place-items: center;
            }
            .search-result-copy {
                display: flex;
                flex-direction: column;
                gap: 0.2rem;
                min-width: 0;
            }
            .search-result-copy strong {
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .search-result-action {
                color: var(--pico-primary);
                font-size: 0.9rem;
                white-space: nowrap;
            }
            @media (max-width: 640px) {
                :host {
                    width: 100%;
                }
                .search-form,
                .search-result {
                    grid-template-columns: minmax(0, 1fr);
                }
            }
        `,
    ];
}
