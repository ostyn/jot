import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './jot-icon';

@customElement('movie-list-item')
export class MovieListItem extends LitElement {
    @property() posterUrl = '';
    @property() title = '';
    @property() subtitle = '';

    render() {
        return html`
            <slot name="leading"></slot>
            <span class="poster" aria-hidden="true">
                ${this.posterUrl
                    ? html`<img src=${this.posterUrl} alt="" loading="lazy" />`
                    : html`<span class="poster-fallback">
                          <jot-icon name="Play"></jot-icon>
                      </span>`}
            </span>
            <span class="body">
                <span class="title-group">
                    <strong class="title">${this.title}</strong>
                    ${this.subtitle
                        ? html`<small class="subtitle">${this.subtitle}</small>`
                        : nothing}
                </span>
                <slot name="trailing"></slot>
            </span>
        `;
    }

    static styles = css`
        :host {
            display: grid;
            grid-template-columns: 4rem minmax(0, 1fr);
            align-items: center;
            gap: 0.75rem;
            padding: 0.85rem 1rem;
            border-radius: var(--pico-border-radius);
            background: var(--pico-card-sectioning-background-color);
        }
        :host(:has(> [slot='leading'])) {
            grid-template-columns: auto 4rem minmax(0, 1fr);
        }
        .poster {
            width: 4rem;
            aspect-ratio: 2 / 3;
            border-radius: calc(var(--pico-border-radius) * 0.8);
            overflow: hidden;
            background: var(--pico-form-element-background-color);
            display: block;
        }
        .poster img,
        .poster-fallback {
            width: 100%;
            height: 100%;
            display: block;
        }
        .poster img {
            object-fit: cover;
        }
        .poster-fallback {
            display: grid;
            place-items: center;
        }
        .body {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            text-align: left;
            min-width: 0;
        }
        .title-group {
            display: flex;
            flex-direction: column;
            gap: 0.16rem;
            min-width: 0;
        }
        .title {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .subtitle {
            margin: 0;
            color: var(--pico-muted-color);
        }
        @media (max-width: 640px) {
            :host {
                grid-template-columns: 3rem minmax(0, 1fr);
                padding: 0.65rem 0.7rem;
            }
            :host(:has(> [slot='leading'])) {
                grid-template-columns: auto 3rem minmax(0, 1fr);
            }
            .poster {
                width: 3rem;
            }
        }
    `;
}

declare global {
    interface HTMLElementTagNameMap {
        'movie-list-item': MovieListItem;
    }
}
