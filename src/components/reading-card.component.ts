import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { ReadingItem } from '../interfaces/reading-item.interface';
import { hostnameFromUrl, statusLabel } from '../utils/reading-helpers';

@customElement('reading-card')
export class ReadingCard extends LitElement {
    @property({ attribute: false })
    item?: ReadingItem;

    @property({ type: Number })
    activeCount = 0;

    private emit(name: string) {
        this.dispatchEvent(
            new CustomEvent(name, { bubbles: true, composed: true })
        );
    }

    render() {
        if (!this.item) return nothing;
        const item = this.item;
        const title = item.title || hostnameFromUrl(item.url);
        const itemStatus = statusLabel(item);

        return html`
            <article class=${item.httpStatus === 404 ? 'broken' : ''}>
                ${item.image
                    ? html`<a
                          class="image-link"
                          href=${item.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          @click=${() => this.emit('reading-open')}
                      >
                          <img class="card-image" src=${item.image} alt="" />
                          <span class="open-badge">
                              <span>Open</span>
                              <jot-icon name="ArrowRight"></jot-icon>
                          </span>
                      </a>`
                    : nothing}
                <div class="copy-block">
                    <div class="meta-row">
                        <span>${item.siteName || hostnameFromUrl(item.url)}</span>
                        ${item.fetchState === 'failed'
                            ? html`<button
                                  class="inline subtle-link retry-inline"
                                  @click=${() => this.emit('reading-retry')}
                              >
                                  Preview unavailable - Retry
                              </button>`
                            : itemStatus
                              ? html`<span>${itemStatus}</span>`
                              : nothing}
                    </div>
                    <a
                        class="copy-link"
                        href=${item.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        @click=${() => this.emit('reading-open')}
                    >
                        <h3>${title}</h3>
                        ${item.description ? html`<p>${item.description}</p>` : nothing}
                        <p class="url meta-text">${item.url}</p>
                    </a>
                </div>
                <div class="action-row" role="group" aria-label="Reading actions">
                    <button
                        class="outline action-button"
                        @click=${() => this.emit('reading-later')}
                    >
                        <jot-icon name="ChevronRight"></jot-icon>
                        Later
                    </button>
                    <button
                        class="outline action-button"
                        @click=${() => this.emit('reading-done')}
                    >
                        <jot-icon name="CalendarCheck"></jot-icon>
                        Read
                    </button>
                    <button
                        class="outline action-button danger-action"
                        @click=${() => this.emit('reading-remove')}
                    >
                        <jot-icon name="Trash2"></jot-icon>
                        Remove
                    </button>
                </div>
                <footer>
                    <small class="meta-text">${this.activeCount} active</small>
                </footer>
            </article>
        `;
    }

    static styles = [
        base,
        css`
            .action-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.35rem;
                margin-bottom: 0;
                min-height: 2.75rem;
                min-width: 0;
                white-space: nowrap;
            }
            .danger-action {
                color: var(--pico-del-color);
                border-color: var(--pico-del-color);
            }
            .subtle-link {
                padding: 0;
                border: 0;
                background: transparent;
                color: var(--pico-primary);
                text-decoration: underline;
                margin-bottom: 0;
            }
            .meta-text {
                color: var(--pico-muted-color);
            }
            article {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            article.broken {
                box-shadow: inset 0 0 0 1px var(--pico-del-color);
            }
            .copy-link h3 {
                margin: 0;
            }
            .image-link,
            .copy-link {
                color: inherit;
                text-decoration: none;
            }
            .image-link {
                position: relative;
                display: block;
                width: 100%;
            }
            .card-image {
                width: 100%;
                aspect-ratio: 16 / 9;
                object-fit: cover;
                border-radius: 0.75rem;
                background: var(--pico-muted-border-color);
            }
            .open-badge {
                position: absolute;
                top: 0.75rem;
                right: 0.75rem;
                display: inline-flex;
                align-items: center;
                gap: 0.35rem;
                padding: 0.4rem 0.65rem;
                border-radius: 999px;
                border: 1px solid var(--pico-contrast-background);
                background: var(--pico-contrast-background);
                color: var(--pico-contrast-inverse);
                font-size: 0.8rem;
                font-weight: 600;
            }
            .copy-block {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
            }
            .meta-row,
            footer {
                color: var(--pico-muted-color);
            }
            .meta-row {
                display: flex;
                justify-content: space-between;
                gap: 0.5rem;
                flex-wrap: wrap;
            }
            .copy-link {
                display: flex;
                flex-direction: column;
                gap: 0.75rem;
            }
            .copy-link h3,
            .copy-link p {
                margin: 0;
            }
            .copy-link p {
                white-space: pre-wrap;
                word-break: break-word;
            }
            .action-row {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 0.375rem;
            }
            .retry-inline {
                margin-bottom: 0;
            }
            footer {
                padding-top: 0.25rem;
                border-top: 1px solid var(--pico-muted-border-color);
            }
            @media (max-width: 640px) {
                .action-row {
                    grid-template-columns: 1fr;
                }
            }
        `,
    ];
}
