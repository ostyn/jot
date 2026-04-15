import { css, html, nothing, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { FaceoffMovie, getMoviePosterUrl } from '../services/movie-faceoff.service';
import { TargetedInsertionState } from '../utils/movie-faceoff-types';
import './jot-icon';

@customElement('movie-faceoff-card')
export class MovieFaceoffCard extends LitElement {
    @property({ attribute: false })
    movie?: FaceoffMovie | null;

    @property({ type: Number })
    index: 0 | 1 = 0;

    @property({ type: Boolean })
    loading = false;

    @property({ type: String })
    errorMessage = '';

    @property({ attribute: false })
    targetedInsertion: TargetedInsertionState | null = null;

    private emit(name: string) {
        this.dispatchEvent(
            new CustomEvent(name, {
                detail: { index: this.index },
                bubbles: true,
                composed: true,
            })
        );
    }

    private getMovieYear(movie: Pick<FaceoffMovie, 'release_date'>) {
        return movie.release_date?.split('-')[0] || 'Unknown year';
    }

    render() {
        if (!this.movie) {
            return this.renderPlaceholder();
        }
        return this.renderMovie(this.movie);
    }

    private renderPlaceholder() {
        const label =
            this.index === 0 ? 'First movie placeholder' : 'Second movie placeholder';
        const message = this.loading ? 'Loading a fresh movie...' : 'No movie loaded';

        return html`
            <div class="movie-card placeholder-card" aria-label=${label}>
                <div class="movie-poster placeholder-poster">
                    <jot-icon name="Play" size="large"></jot-icon>
                </div>
                <div class="movie-copy placeholder-copy">
                    <h3>${message}</h3>
                    <p>
                        ${this.errorMessage
                            ? 'Try again once the catalog is available.'
                            : 'The next matchup will appear here.'}
                    </p>
                </div>
            </div>
        `;
    }

    private renderMovie(movie: FaceoffMovie) {
        const imageUrl = getMoviePosterUrl(movie);
        const year = this.getMovieYear(movie);
        const isTargetedCard = this.targetedInsertion?.targetMovie.id === movie.id;

        return html`
            <div class="movie-card ${isTargetedCard ? 'target-card' : ''}">
                ${imageUrl
                    ? html`<button
                          class="poster-button movie-poster"
                          aria-label=${`Pick ${movie.title}`}
                          @click=${() => this.emit('faceoff-vote')}
                      >
                          <img src=${imageUrl} alt=${movie.title} />
                      </button>`
                    : html`<button
                          class="poster-button poster-fallback movie-poster"
                          aria-label=${`Pick ${movie.title}`}
                          @click=${() => this.emit('faceoff-vote')}
                      >
                          <jot-icon name="Play" size="large"></jot-icon>
                          <span>No poster available</span>
                      </button>`}
                <div class="movie-copy">
                    <div class="movie-title-row">
                        <div>
                            <h3 title=${movie.title}>${movie.title}</h3>
                            <p>${year}</p>
                            ${this.targetedInsertion
                                ? html`<small class="targeted-card-label">
                                      ${isTargetedCard
                                          ? 'Target movie'
                                          : `Compare against #${
                                                this.targetedInsertion.pivotIndex + 1
                                            }`}
                                  </small>`
                                : nothing}
                        </div>
                    </div>
                </div>
                <footer class="movie-actions">
                    <button
                        class="secondary"
                        @click=${() => this.emit('faceoff-unseen')}
                    >
                        <jot-icon name="EyeOff"></jot-icon>
                        Not seen
                    </button>
                </footer>
            </div>
        `;
    }

    static styles = [
        base,
        css`
            :host {
                display: block;
                min-width: 0;
                flex: 1;
            }
            .movie-card {
                display: flex;
                flex-direction: column;
                gap: 0.85rem;
                min-height: 100%;
            }
            .movie-title-row {
                min-width: 0;
            }
            .movie-copy {
                min-width: 0;
            }
            .movie-copy h3 {
                margin: 0;
                font-size: clamp(1.1rem, 1rem + 0.55vw, 1.5rem);
                line-height: 1.1;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .movie-copy p {
                margin-top: 0.35rem;
            }
            .poster-button {
                padding: 0;
                cursor: pointer;
                overflow: hidden;
                position: relative;
            }
            .movie-poster {
                aspect-ratio: 2 / 3;
                border-radius: var(--pico-border-radius);
                overflow: hidden;
                background: var(--pico-card-sectioning-background-color);
            }
            .poster-button img {
                width: 100%;
                height: 100%;
                object-fit: cover;
                display: block;
            }
            .poster-button::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(180deg, transparent 25%, rgba(0, 0, 0, 0.25) 100%);
                pointer-events: none;
            }
            .poster-fallback {
                display: grid;
                place-items: center;
                gap: 0.6rem;
                text-align: center;
            }
            .targeted-card-label {
                display: inline-flex;
                margin-top: 0.5rem;
                font-size: 0.82rem;
                margin-bottom: 0;
                color: var(--pico-muted-color);
            }
            .movie-actions {
                margin-top: auto;
                margin-bottom: auto;
            }
            .placeholder-card {
                display: grid;
                gap: 0.85rem;
                place-items: center;
                text-align: center;
                margin: 0;
                min-height: 100%;
            }
            .placeholder-poster {
                display: grid;
                place-items: center;
            }
            .placeholder-copy {
                display: grid;
                gap: 0.35rem;
                width: 100%;
            }
            .placeholder-copy h3 {
                margin: 0;
            }
            .placeholder-copy p {
                margin: 0;
                color: var(--pico-muted-color);
            }
            @media (max-width: 640px) {
                .movie-actions button {
                    width: 100%;
                    justify-content: center;
                }
            }
        `,
    ];
}
