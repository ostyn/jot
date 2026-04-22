import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../jot-icon';

@customElement('movie-list-item')
export class MovieListItem extends LitElement {
    @property() posterUrl = '';
    @property() title = '';
    @property() subtitle = '';
    @property({ reflect: true }) layout: 'compact' | 'stacked' = 'compact';

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
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.85rem 1rem;
            border-radius: var(--pico-border-radius);
            background: var(--pico-card-sectioning-background-color);
        }
        .poster {
            flex: 0 0 4rem;
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
            flex: 1 1 auto;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            justify-content: space-between;
            gap: 0.5rem 0.75rem;
            text-align: left;
            min-width: 0;
        }
        :host([layout='stacked']) .body {
            flex-direction: column;
            flex-wrap: nowrap;
            align-items: stretch;
            gap: 0.5rem;
        }
        :host([layout='stacked']) slot[name='trailing'] {
            display: contents;
        }
        .title-group {
            display: flex;
            flex-direction: column;
            gap: 0.16rem;
            min-width: 0;
            flex: 1 1 8rem;
        }
        :host([layout='stacked']) .title-group {
            flex: none;
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
        ::slotted([slot='trailing']) {
            flex-shrink: 0;
        }
        :host([layout='stacked']) ::slotted([slot='trailing']) {
            flex-shrink: 1;
        }
        @media (max-width: 640px) {
            :host {
                padding: 0.65rem 0.7rem;
            }
            .poster {
                flex: 0 0 3rem;
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
