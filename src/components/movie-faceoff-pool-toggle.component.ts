import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../baseStyles';

@customElement('movie-faceoff-pool-toggle')
export class MovieFaceoffPoolToggle extends LitElement {
    @property({ type: Boolean })
    useRankedOnly = false;

    @property({ type: Boolean })
    disabled = false;

    private emitChange(useRankedOnly: boolean) {
        if (this.useRankedOnly === useRankedOnly) return;
        this.dispatchEvent(
            new CustomEvent('pool-change', {
                detail: { useRankedOnly },
                bubbles: true,
                composed: true,
            })
        );
    }

    render() {
        return html`
            <div role="group" class="pool-toggle" aria-label="Movie pool">
                <button
                    class=${this.useRankedOnly ? 'outline' : ''}
                    aria-pressed=${!this.useRankedOnly}
                    ?disabled=${this.disabled}
                    @click=${() => this.emitChange(false)}
                >
                    All movies
                </button>
                <button
                    class=${this.useRankedOnly ? '' : 'outline'}
                    aria-pressed=${this.useRankedOnly}
                    ?disabled=${this.disabled}
                    @click=${() => this.emitChange(true)}
                >
                    My movies
                </button>
            </div>
        `;
    }

    static styles = [
        base,
        css`
            :host {
                display: block;
                width: fit-content;
            }
            @media (max-width: 900px) {
                :host {
                    width: 100%;
                }
            }
            @media (max-width: 640px) {
                :host {
                    width: 100%;
                }
                .pool-toggle button {
                    width: 100%;
                }
            }
        `,
    ];
}
