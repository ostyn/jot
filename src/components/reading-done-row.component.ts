import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { ReadingItem } from '../interfaces/reading-item.interface';
import { hostnameFromUrl, statusLabel } from '../utils/reading-helpers';

@customElement('reading-done-row')
export class ReadingDoneRow extends LitElement {
    @property({ attribute: false })
    item?: ReadingItem;

    private emit(name: string) {
        this.dispatchEvent(
            new CustomEvent(name, { bubbles: true, composed: true })
        );
    }

    render() {
        if (!this.item) return nothing;
        const item = this.item;
        const showRetry = item.fetchState === 'failed';
        const itemStatus = statusLabel(item);
        const title = item.title || hostnameFromUrl(item.url);

        return html`
            <div class="row ${item.image ? '' : 'row-no-thumb'}">
                ${item.image
                    ? html`<div class="media">
                          <a href=${item.url} target="_blank" rel="noreferrer noopener">
                              <img class="thumb" src=${item.image} alt="" />
                          </a>
                          <button
                              class="outline action-button requeue"
                              @click=${() => this.emit('reading-requeue')}
                          >
                              <jot-icon name="ChevronRight"></jot-icon>
                              Requeue
                          </button>
                      </div>`
                    : nothing}
                <a class="copy" href=${item.url} target="_blank" rel="noreferrer noopener">
                    <strong>${title}</strong>
                    <p class="meta meta-text">
                        ${item.siteName || hostnameFromUrl(item.url)}
                        ${!showRetry && itemStatus
                            ? html`<span> · ${itemStatus}</span>`
                            : nothing}
                        ${item.completedAt
                            ? html`<span> · ${new Date(item.completedAt).toLocaleDateString()}</span>`
                            : nothing}
                    </p>
                    ${item.description
                        ? html`<p class="description meta-text">${item.description}</p>`
                        : nothing}
                </a>
                <div class="side">
                    ${showRetry
                        ? html`<button
                              class="inline subtle-link"
                              @click=${() => this.emit('reading-retry')}
                          >
                              Preview unavailable · Retry
                          </button>`
                        : nothing}
                    ${!item.image
                        ? html`<button
                              class="outline action-button requeue"
                              @click=${() => this.emit('reading-requeue')}
                          >
                              <jot-icon name="ChevronRight"></jot-icon>
                              Requeue
                          </button>`
                        : nothing}
                </div>
            </div>
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
            .row {
                display: grid;
                grid-template-columns: 7.5rem minmax(0, 1fr) auto;
                gap: 1rem;
                padding: 0.875rem 0;
                border-bottom: 1px solid var(--pico-muted-border-color);
                align-items: start;
            }
            .row:last-child {
                border-bottom: 0;
            }
            .row-no-thumb {
                grid-template-columns: minmax(0, 1fr) auto;
            }
            .media {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                width: 7.5rem;
            }
            .media a,
            .copy {
                text-decoration: none;
                color: inherit;
            }
            .thumb {
                width: 100%;
                aspect-ratio: 1;
                object-fit: cover;
                border-radius: 0.5rem;
                background: var(--pico-muted-border-color);
            }
            .copy {
                min-width: 0;
            }
            .copy strong {
                display: block;
                line-height: 1.3;
            }
            .meta,
            .description {
                margin: 0.25rem 0 0;
            }
            .description {
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
            }
            .side {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 0.5rem;
            }
            .requeue {
                width: 100%;
            }
            @media (max-width: 640px) {
                .row {
                    grid-template-columns: 7.5rem minmax(0, 1fr);
                }
                .side {
                    grid-column: 2;
                    align-items: flex-start;
                }
                .row-no-thumb {
                    grid-template-columns: 1fr;
                }
                .row-no-thumb .side {
                    grid-column: 1;
                }
            }
        `,
    ];
}
