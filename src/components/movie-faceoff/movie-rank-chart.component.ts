import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { base } from '../../baseStyles';
import { MovieFaceoffRankingAlgorithm } from '../../utils/movie-faceoff-rankings';
import { RankingSnapshot } from '../../utils/movie-ranking-snapshots';
import { sectionCardStyles } from './movie-detail-section.styles';

@customElement('movie-rank-chart')
export class MovieRankChart extends LitElement {
    @property({ attribute: false })
    snapshots: RankingSnapshot[] = [];

    private emitMethodClick(algorithm: MovieFaceoffRankingAlgorithm) {
        this.dispatchEvent(
            new CustomEvent('method-click', {
                detail: { algorithm },
                bubbles: true,
                composed: true,
            })
        );
    }

    private renderRow = (snapshot: RankingSnapshot) => {
        const pct = snapshot.percentile;
        const isAgg = snapshot.algorithm.isAggregate;
        return html`
            <button
                class="name ${isAgg ? 'aggregate' : ''}"
                @click=${() => this.emitMethodClick(snapshot.algorithm)}
                aria-label="About ${snapshot.algorithm.label}"
            >
                ${snapshot.algorithm.label}
            </button>
            <div class="track">
                ${pct === null
                    ? nothing
                    : html`<span
                          class="dot ${isAgg ? '' : 'muted'}"
                          style=${styleMap({ left: `${pct * 100}%` })}
                      ></span>`}
            </div>
            <span class="rank">
                ${snapshot.rank === null ? '—' : `#${snapshot.rank}`}
            </span>
        `;
    };

    render() {
        if (!this.snapshots.length) return nothing;

        const aggregates = this.snapshots.filter((s) => s.algorithm.isAggregate);
        const primaries = this.snapshots.filter(
            (s) => !s.algorithm.isAggregate && !s.algorithm.isInformational
        );

        return html`
            <section class="surface-panel section-card">
                <header class="section-header chart-header">
                    <hgroup>
                        <p class="eyebrow">Rank distribution</p>
                        <h3>Where it lands across methods</h3>
                    </hgroup>
                    <p class="chart-caption">
                        Each dot marks this movie in that method (left = top, right =
                        bottom). Tap a method name for details.
                    </p>
                </header>

                <div class="dist">
                    ${aggregates.length
                        ? html`
                              <div class="group-label">Aggregate</div>
                              ${aggregates.map(this.renderRow)}
                          `
                        : nothing}
                    ${primaries.length
                        ? html`
                              <div class="divider"></div>
                              <div class="group-label">Individual methods</div>
                              ${primaries.map(this.renderRow)}
                          `
                        : nothing}
                </div>
            </section>
        `;
    }

    static styles = [
        base,
        sectionCardStyles,
        css`
            .chart-header {
                flex-direction: column;
                align-items: flex-start;
            }
            .chart-caption {
                margin: 0;
                color: var(--pico-muted-color);
                font-size: 0.85rem;
            }
            .dist {
                display: grid;
                grid-template-columns: 10rem minmax(0, 1fr) 3.5rem;
                gap: 0.65rem 1rem;
                align-items: center;
                font-size: 0.9rem;
            }
            .group-label {
                grid-column: 1 / -1;
                font-size: 0.72rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--pico-muted-color);
                margin-top: 0.3rem;
            }
            .divider {
                grid-column: 1 / -1;
                height: 1px;
                background: color-mix(in srgb, var(--pico-muted-color) 18%, transparent);
                margin: 0.1rem 0;
            }
            .name {
                color: var(--pico-color);
                font-weight: 500;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                background: none;
                border: 0;
                padding: 0;
                margin: 0;
                text-align: left;
                font: inherit;
                cursor: pointer;
                display: flex;
                justify-self: start;
                justify-content: flex-start;
                align-items: center;
                gap: 0.4rem;
                line-height: 1.2;
            }
            .name::after {
                content: 'ⓘ';
                color: var(--pico-muted-color);
                font-size: 0.85em;
                opacity: 0.55;
                transition: opacity 120ms ease;
            }
            .name:hover,
            .name:focus-visible {
                color: var(--pico-primary);
                outline: none;
            }
            .name:hover::after,
            .name:focus-visible::after {
                opacity: 1;
                color: var(--pico-primary);
            }
            .name.aggregate {
                color: var(--pico-primary);
                font-weight: 600;
            }
            .name.aggregate::after {
                color: var(--pico-primary);
            }
            .track {
                position: relative;
                height: 0.55rem;
                border-radius: 999px;
                background: color-mix(in srgb, var(--pico-muted-color) 14%, transparent);
            }
            .dot {
                position: absolute;
                top: 50%;
                width: 1rem;
                height: 1rem;
                border-radius: 999px;
                transform: translate(-50%, -50%);
                background: var(--pico-primary);
                box-shadow: 0 0 0 3px
                    color-mix(in srgb, var(--pico-primary) 25%, transparent);
            }
            .dot.muted {
                background: color-mix(in srgb, var(--pico-color) 65%, transparent);
                box-shadow: 0 0 0 3px
                    color-mix(in srgb, var(--pico-color) 18%, transparent);
            }
            .rank {
                text-align: right;
                font-variant-numeric: tabular-nums;
                font-weight: 600;
            }

            @media (max-width: 720px) {
                .dist {
                    grid-template-columns: 7rem minmax(0, 1fr) 3rem;
                    font-size: 0.85rem;
                }
            }
        `,
    ];
}
