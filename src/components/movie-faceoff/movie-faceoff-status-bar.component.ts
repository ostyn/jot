import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import '../jot-icon';

export type MovieFaceoffStatusTone = 'error' | 'loading' | 'active' | 'idle';

@customElement('movie-faceoff-status-bar')
export class MovieFaceoffStatusBar extends LitElement {
    @property({ type: String })
    statusTone: MovieFaceoffStatusTone = 'idle';

    @property({ type: String })
    statusLabel = '';

    @property({ type: Boolean })
    showUndo = false;

    @property({ type: Number })
    rankedCount = 0;

    @property({ type: Number })
    votesCount = 0;

    @property({ attribute: false })
    availableCount: number | null = null;

    private emitUndo() {
        this.dispatchEvent(
            new CustomEvent('undo-action', { bubbles: true, composed: true })
        );
    }

    private renderSummaryStat(label: string, value: string | number, accent = false) {
        return html`
            <article class="summary-stat ${accent ? 'accent' : ''}">
                <p>${label}</p>
                <strong>${value}</strong>
            </article>
        `;
    }

    render() {
        return html`
            <div class="feedback-bar">
                <p class="status-chip ${this.statusTone}" role="status">
                    ${this.statusTone === 'error'
                        ? html`<jot-icon name="AlertTriangle"></jot-icon>`
                        : html`<span class="status-dot" aria-hidden="true"></span>`}
                    <span>${this.statusLabel}</span>
                </p>
                ${this.showUndo
                    ? html`<button class="secondary" @click=${() => this.emitUndo()}>
                          <jot-icon name="RotateCcw"></jot-icon>
                          Undo
                      </button>`
                    : nothing}
            </div>

            <div class="summary-grid session-summary">
                ${this.renderSummaryStat('Ranked', this.rankedCount, true)}
                ${this.renderSummaryStat('Votes', this.votesCount)}
                ${this.renderSummaryStat('Available', this.availableCount ?? '...')}
            </div>

            <p class="session-hint">
                Keyboard shortcuts:
                <kbd>Shift</kbd> + <kbd>Arrow</kbd> marks one movie unseen,
                <kbd>Down</kbd> marks both.
            </p>
        `;
    }

    static styles = [
        base,
        css`
            :host {
                display: grid;
                gap: 1rem;
            }
            .feedback-bar {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                gap: 0.75rem;
                align-items: center;
            }
            .feedback-bar > * {
                min-width: 0;
            }
            .summary-grid {
                display: grid;
                gap: 0.75rem;
                grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
            }
            .summary-stat {
                display: grid;
                gap: 0.35rem;
                margin: 0;
                padding: 0.85rem 1rem;
            }
            .summary-stat.accent {
                border-color: color-mix(
                    in srgb,
                    var(--pico-primary-border) 70%,
                    var(--pico-card-border-color)
                );
                background: color-mix(
                    in srgb,
                    var(--pico-primary-background) 16%,
                    var(--pico-card-background-color)
                );
            }
            .summary-stat p,
            .session-hint {
                margin: 0;
                color: var(--pico-muted-color);
            }
            .summary-stat strong {
                font-size: 1.1rem;
            }
            .status-chip {
                display: inline-flex;
                align-items: center;
                gap: 0.65rem;
                margin: 0;
                padding: 0.6rem 0.9rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .status-chip.error {
                color: var(--pico-del-color);
            }
            .status-dot {
                width: 0.6rem;
                height: 0.6rem;
                border-radius: 999px;
                background: var(--pico-ins-color);
                flex: none;
            }
            .status-chip.loading .status-dot {
                background: var(--pico-primary);
            }
            .status-chip.active .status-dot {
                background: var(--pico-secondary);
            }
            kbd {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 1.5rem;
                padding: 0.12rem 0.35rem;
                border-radius: 0.4rem;
                font: inherit;
                font-size: 0.8em;
            }
            @media (max-width: 640px) {
                .feedback-bar,
                .feedback-bar button {
                    width: 100%;
                }
                .summary-grid {
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
            }
        `,
    ];
}
