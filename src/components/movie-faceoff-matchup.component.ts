import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { FaceoffPair, TargetedInsertionState } from '../utils/movie-faceoff-types';
import './jot-icon';
import './movie-faceoff-card.component';

@customElement('movie-faceoff-matchup')
export class MovieFaceoffMatchup extends LitElement {
    @property({ attribute: false })
    movies: FaceoffPair = [null, null];

    @property({ type: Boolean })
    loading = false;

    @property({ type: String })
    errorMessage = '';

    @property({ attribute: false })
    targetedInsertion: TargetedInsertionState | null = null;

    render() {
        const [left, right] = this.movies;
        return html`
            ${this.errorMessage
                ? html`<aside class="status-banner error" role="alert">
                      <jot-icon name="AlertTriangle"></jot-icon>
                      <span>${this.errorMessage}</span>
                  </aside>`
                : nothing}
            <section class="matchup-shell" aria-label="Current matchup">
                <div class="matchup">
                    <movie-faceoff-card
                        .movie=${left}
                        .index=${0 as const}
                        .loading=${this.loading}
                        .errorMessage=${this.errorMessage}
                        .targetedInsertion=${this.targetedInsertion}
                    ></movie-faceoff-card>
                    <div class="matchup-divider" aria-hidden="true">
                        <span>VS</span>
                    </div>
                    <movie-faceoff-card
                        .movie=${right}
                        .index=${1 as const}
                        .loading=${this.loading}
                        .errorMessage=${this.errorMessage}
                        .targetedInsertion=${this.targetedInsertion}
                    ></movie-faceoff-card>
                </div>
            </section>
        `;
    }

    static styles = [
        base,
        css`
            :host {
                display: contents;
            }
            .status-banner {
                display: flex;
                align-items: center;
                gap: 0.65rem;
                margin: 0;
            }
            .status-banner.error {
                color: var(--pico-del-color);
            }
            .matchup {
                position: relative;
                display: flex;
                gap: 1rem;
                align-items: start;
            }
            .matchup,
            .matchup > * {
                min-width: 0;
            }
            .matchup > * {
                flex: 1;
            }
            .matchup-divider {
                flex: none;
                display: grid;
                place-items: center;
                align-self: center;
            }
            .matchup-divider span {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 999px;
                background: var(--pico-card-sectioning-background-color);
                font-size: 0.75rem;
                font-weight: 700;
                letter-spacing: 0.08em;
            }
            @media (max-width: 640px) {
                .matchup {
                    gap: 0.55rem;
                    align-items: stretch;
                }
                .matchup-divider {
                    position: absolute;
                    inset: 34% auto auto 50%;
                    transform: translate(-50%, -50%);
                    z-index: 2;
                    pointer-events: none;
                }
                .matchup-divider span {
                    width: 1.85rem;
                    height: 1.85rem;
                    font-size: 0.56rem;
                    letter-spacing: 0.08em;
                }
            }
        `,
    ];
}
