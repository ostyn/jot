import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { MovieFaceoffMovie } from '../../interfaces/movie-faceoff.interface';
import {
    FaceoffMovieCrewMember,
    FaceoffMovieDetails,
    getMovieBackdropUrl,
    getMoviePosterUrl,
} from '../../services/movie-faceoff.service';
import {
    formatDate,
    formatRuntime,
    formatVoteAverage,
} from '../../utils/movie-detail-format';
import '../jot-icon';

@customElement('movie-hero')
export class MovieHero extends LitElement {
    @property({ attribute: false })
    details?: FaceoffMovieDetails;

    @property({ attribute: false })
    storedMovie?: MovieFaceoffMovie;

    private get director(): FaceoffMovieCrewMember | undefined {
        return this.details?.credits?.crew?.find((person) => person.job === 'Director');
    }

    render() {
        const { details, storedMovie } = this;
        const title = details?.title || storedMovie?.title || 'Movie';
        const posterUrl = getMoviePosterUrl(
            details || { poster_path: storedMovie?.posterPath }
        );
        const backdropUrl = getMovieBackdropUrl(
            details || { backdrop_path: undefined }
        );
        const year = (details?.release_date || storedMovie?.releaseDate || '').split(
            '-'
        )[0];
        const genres = details?.genres?.map((g) => g.name).join(' · ') || '';
        const director = this.director;

        const pills = [
            formatDate(details?.release_date || storedMovie?.releaseDate),
            formatRuntime(details?.runtime),
            genres,
            formatVoteAverage(details?.vote_average, details?.vote_count),
            storedMovie ? `Tracked ${formatDate(storedMovie.createdAt)}` : '',
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
                            ${title}${year ? html` <span>(${year})</span>` : nothing}
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

    static styles = [
        base,
        css`
            :host {
                display: block;
            }
            .surface-panel {
                position: relative;
                overflow: hidden;
                margin: 0;
            }
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
                min-width: 0;
                padding-top: 7rem;
            }
            .eyebrow {
                margin: 0 0 0.2rem;
                font-size: 0.75rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--pico-muted-color);
            }
            h2 {
                margin: 0;
                font-size: 1.5rem;
                line-height: 1.2;
            }
            h2 span {
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

            @media (max-width: 720px) {
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
            }
        `,
    ];
}
