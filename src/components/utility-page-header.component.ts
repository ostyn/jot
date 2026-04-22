import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../baseStyles';
import './jot-icon';

@customElement('utility-page-header')
export class UtilityPageHeader extends LitElement {
    @property()
    title = '';

    @property()
    backHref = '/settings';

    @property()
    backLabel = 'Tools';

    @property({ type: Boolean })
    useHistoryBack = false;

    render() {
        return html`
            <header class="utility-header">
                <a class="back-link" href=${this.backHref} @click=${this.useHistoryBack ? (e: Event) => {
                    e.preventDefault();
                    history.back();
                } : undefined}>
                    <jot-icon name="ChevronLeft"></jot-icon>
                    <span>${this.backLabel}</span>
                </a>
                ${this.title ? html`<h1>${this.title}</h1>` : html`<span class="spacer"></span>`}
                <div class="actions">
                    <slot name="actions"></slot>
                </div>
            </header>
        `;
    }

    static styles = [
        base,
        css`
            .utility-header {
                display: flex;
                align-items: center;
                gap: 0.5rem;
                min-height: 2.5rem;
                padding: 0.75rem 0 1rem;
            }
            .back-link {
                flex: 0 0 auto;
                display: inline-grid;
                grid-auto-flow: column;
                align-items: center;
                gap: 0.25rem;
                color: var(--pico-muted-color);
                text-decoration: none;
                font-size: 0.9rem;
                white-space: nowrap;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .back-link jot-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                align-self: center;
            }
            h1,
            .spacer {
                flex: 1 1 auto;
                min-width: 0;
            }
            h1 {
                margin: 0;
                font-size: 1.1rem;
                text-align: center;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .actions {
                flex: 0 0 auto;
                display: flex;
                justify-content: flex-end;
                align-items: center;
                gap: 0.5rem;
            }
        `,
    ];
}
