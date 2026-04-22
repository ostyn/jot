import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { movieFaceoffShared } from '../../movieFaceoffStyles';
import { MovieFaceoffSortMode } from '../../interfaces/movie-faceoff.interface';
import { TargetedInsertionState } from '../../utils/movie-faceoff-types';
import { getMovieFaceoffRankingAlgorithm } from '../../utils/movie-faceoff-rankings';
import '../jot-icon';

@customElement('movie-faceoff-targeted-banner')
export class MovieFaceoffTargetedBanner extends LitElement {
    @property({ attribute: false })
    targetedInsertion: TargetedInsertionState | null = null;

    @property({ type: String })
    sortMode: MovieFaceoffSortMode = 'elo';

    private get progressLabel() {
        const session = this.targetedInsertion;
        if (!session) return '';
        const remainingWindow = Math.max(session.high - session.low, 0);
        if (session.complete) return 'Placement locked';
        if (!session.rankedSnapshot.length) return 'Need more ranked movies';
        return `${session.comparisonsCompleted} comparison${
            session.comparisonsCompleted === 1 ? '' : 's'
        } made, ${remainingWindow + 1} possible slot${
            remainingWindow === 0 ? '' : 's'
        } left`;
    }

    private emitCancel() {
        this.dispatchEvent(
            new CustomEvent('cancel-targeted-insertion', {
                bubbles: true,
                composed: true,
            })
        );
    }

    render() {
        const session = this.targetedInsertion;
        if (!session) return nothing;

        const estimatedPlacement = Math.min(
            session.rankedSnapshot.length + 1,
            session.low + 1
        );

        return html`
            <article class="targeted-banner">
                <div class="targeted-copy">
                    <hgroup>
                        <p class="eyebrow">Targeted placement</p>
                        <h3>${session.targetMovie.title}</h3>
                    </hgroup>
                    <p>
                        Compare it against key movies in
                        ${getMovieFaceoffRankingAlgorithm(this.sortMode).label}.
                        Current estimated slot: #${estimatedPlacement}.
                    </p>
                </div>
                <div class="targeted-meta">
                    <strong>${this.progressLabel}</strong>
                    <button class="secondary" @click=${() => this.emitCancel()}>
                        <jot-icon name="XCircle"></jot-icon>
                        Cancel
                    </button>
                </div>
            </article>
        `;
    }

    static styles = [
        base,
        movieFaceoffShared,
        css`
            :host {
                display: block;
            }
            .targeted-banner {
                display: grid;
                grid-template-columns: minmax(0, 1fr) auto;
                align-items: center;
                gap: 0.75rem;
                padding: 1rem;
                border-radius: var(--pico-border-radius);
                background: color-mix(
                    in srgb,
                    var(--pico-card-sectioning-background-color) 78%,
                    var(--pico-card-background-color)
                );
            }
            .targeted-meta {
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .targeted-copy {
                min-width: 0;
            }
            .targeted-copy p:last-child {
                margin: 0;
                color: var(--pico-muted-color);
            }
            @media (max-width: 640px) {
                :host {
                    display: none;
                }
                .targeted-meta {
                    align-items: stretch;
                }
            }
        `,
    ];
}
