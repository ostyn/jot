import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import {
    FaceoffMovieCastMember,
    getCastProfileUrl,
} from '../../services/movie-faceoff.service';
import { sectionCardStyles } from './movie-detail-section.styles';

const MAX_CAST = 12;

@customElement('movie-cast-row')
export class MovieCastRow extends LitElement {
    @property({ attribute: false })
    cast: FaceoffMovieCastMember[] = [];

    private get topCast(): FaceoffMovieCastMember[] {
        return this.cast
            .slice()
            .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
            .slice(0, MAX_CAST);
    }

    render() {
        const top = this.topCast;
        if (!top.length) return nothing;

        return html`
            <section class="surface-panel section-card">
                <header class="section-header">
                    <hgroup>
                        <p class="eyebrow">Top billed cast</p>
                        <h3>Cast</h3>
                    </hgroup>
                </header>
                <ul class="cast-row">
                    ${top.map((person) => {
                        const profileUrl = getCastProfileUrl(person);
                        return html`
                            <li class="cast-card">
                                ${profileUrl
                                    ? html`<img
                                          class="cast-photo"
                                          src=${profileUrl}
                                          alt=${person.name}
                                          loading="lazy"
                                      />`
                                    : html`<div class="cast-photo cast-photo-fallback">
                                          <span>${person.name.charAt(0)}</span>
                                      </div>`}
                                <p class="cast-name">${person.name}</p>
                                ${person.character
                                    ? html`<p class="cast-character">
                                          ${person.character}
                                      </p>`
                                    : nothing}
                            </li>
                        `;
                    })}
                </ul>
            </section>
        `;
    }

    static styles = [
        base,
        sectionCardStyles,
        css`
            .cast-row {
                list-style: none;
                margin: 0;
                padding: 0;
                display: grid;
                grid-auto-flow: column;
                grid-auto-columns: 7.5rem;
                gap: 0.75rem;
                overflow-x: auto;
                padding-bottom: 0.4rem;
                scrollbar-width: thin;
            }
            .cast-card {
                display: grid;
                gap: 0.4rem;
                background: var(--pico-card-sectioning-background-color);
                border-radius: var(--pico-border-radius);
                padding: 0.5rem;
            }
            .cast-photo {
                width: 100%;
                aspect-ratio: 2 / 3;
                object-fit: cover;
                border-radius: calc(var(--pico-border-radius) - 0.15rem);
                background: color-mix(in srgb, var(--pico-muted-color) 18%, transparent);
            }
            .cast-photo-fallback {
                display: grid;
                place-items: center;
                color: var(--pico-muted-color);
                font-size: 1.8rem;
                font-weight: 600;
                text-transform: uppercase;
            }
            .cast-name {
                margin: 0;
                font-size: 0.82rem;
                font-weight: 600;
                line-height: 1.2;
            }
            .cast-character {
                margin: 0;
                font-size: 0.75rem;
                color: var(--pico-muted-color);
                line-height: 1.2;
            }
        `,
    ];
}
