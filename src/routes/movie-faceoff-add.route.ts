import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { movieFaceoffShared } from '../movieFaceoffStyles';
import '../components/jot-icon';
import '../components/movie-faceoff/movie-list-item.component';
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
        betterGo('movie-faceoff-movie', {
            pathParams: { id: movie.id },
        });
    }

    render() {
        return html`
            <utility-page-header
                title="Find Movie"
                backHref="/movie-faceoff"
                backLabel="Movie Faceoff"
                useHistoryBack
            ></utility-page-header>
            <main class="layout">
                <section class="surface-panel search-panel">
                    <header class="panel-header">
                        <hgroup>
                            <h2>Find a movie</h2>
                            <p class="text-muted">
                                Search TMDB and view details or start a ranking session.
                            </p>
                        </hgroup>
                    </header>

                    <form
                        role="search"
                        @submit=${(event: Event) => {
                            void this.handleMovieSearch(event);
                        }}
                    >
                        <div role="group">
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
                            <button type="submit">
                                <jot-icon name="Search"></jot-icon>
                                ${this.isSearching ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                    </form>

                    ${this.searchErrorMessage
                        ? html`<p class="text-muted" style="color:var(--pico-del-color)">
                              ${this.searchErrorMessage}
                          </p>`
                        : nothing}

                    ${this.searchResults.length
                        ? html`
                              <ul class="movie-list">
                                  ${this.searchResults.map((movie) => {
                                      const posterUrl = getMoviePosterUrl(movie);
                                      return html`
                                          <li>
                                              <movie-list-item
                                                  .posterUrl=${posterUrl}
                                                  .title=${movie.title}
                                                  .subtitle=${this.getMovieYear(movie)}
                                              >
                                                  <button
                                                      slot="trailing"
                                                      class="outline"
                                                      @click=${() => this.selectMovie(movie)}
                                                  >
                                                      Details
                                                  </button>
                                              </movie-list-item>
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
        movieFaceoffShared,
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
            @media (max-width: 640px) {
                :host {
                    width: 100%;
                }
            }
        `,
    ];
}
