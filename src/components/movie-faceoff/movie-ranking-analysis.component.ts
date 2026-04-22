import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { RankingSnapshot } from '../../utils/movie-ranking-snapshots';
import { sectionCardStyles } from './movie-detail-section.styles';

@customElement('movie-ranking-analysis')
export class MovieRankingAnalysis extends LitElement {
    @property({ attribute: false })
    headline?: RankingSnapshot;

    @property({ attribute: false })
    uncertainty?: RankingSnapshot;

    @property({ attribute: false })
    rankRange: { min: number; max: number } | null = null;

    render() {
        const { headline, uncertainty, rankRange } = this;
        const total = headline?.total || 0;
        const rankText =
            headline?.rank === null || headline?.rank === undefined
                ? '—'
                : `#${headline.rank}`;

        return html`
            <section class="surface-panel section-card">
                <header class="section-header">
                    <hgroup>
                        <p class="eyebrow">Ranking analysis</p>
                        <h3>How this movie ranks</h3>
                    </hgroup>
                </header>

                <div class="headline-row">
                    <article class="headline-card">
                        <p class="card-eyebrow">Weighted Consensus</p>
                        <div class="rank-headline">
                            <span class="rank-big">${rankText}</span>
                            ${total
                                ? html`<span class="rank-of">of ${total}</span>`
                                : nothing}
                        </div>
                        <p class="card-note">
                            The headline rank — reflects agreement across all primary
                            methods.
                        </p>
                    </article>

                    <article class="uncertainty-card">
                        <p class="card-eyebrow">Uncertainty across methods</p>
                        <div class="uncertainty-value">
                            <strong>${uncertainty?.metric || '—'}</strong>
                            <span class="muted">spread</span>
                        </div>
                        ${rankRange && total
                            ? html`
                                  <div class="range-track">
                                      <div
                                          class="range-fill"
                                          style="left:${((rankRange.min - 1) /
                                              Math.max(1, total - 1)) *
                                          100}%; right:${(1 -
                                              (rankRange.max - 1) /
                                                  Math.max(1, total - 1)) *
                                          100}%"
                                      ></div>
                                  </div>
                                  <div class="range-endpoints">
                                      <span>Best: #${rankRange.min}</span>
                                      <span>Worst: #${rankRange.max}</span>
                                  </div>
                              `
                            : nothing}
                    </article>
                </div>
            </section>
        `;
    }

    static styles = [
        base,
        sectionCardStyles,
        css`
            .headline-row {
                display: grid;
                grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
                gap: 1rem;
            }
            .headline-card,
            .uncertainty-card {
                margin: 0;
                padding: 1.1rem 1.25rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .headline-card {
                background: color-mix(
                    in srgb,
                    var(--pico-primary-background) 14%,
                    var(--pico-card-sectioning-background-color)
                );
                border: 1px solid
                    color-mix(in srgb, var(--pico-primary) 35%, transparent);
            }
            .card-eyebrow {
                margin: 0 0 0.45rem;
                font-size: 0.72rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--pico-muted-color);
            }
            .rank-headline {
                display: flex;
                align-items: baseline;
                gap: 0.4rem;
            }
            .rank-big {
                font-size: 2.6rem;
                font-weight: 700;
                line-height: 1;
                font-variant-numeric: tabular-nums;
                color: var(--pico-primary);
            }
            .rank-of {
                color: var(--pico-muted-color);
                font-size: 0.95rem;
                font-weight: 500;
            }
            .card-note {
                margin: 0.55rem 0 0;
                color: var(--pico-muted-color);
                font-size: 0.88rem;
            }
            .uncertainty-value {
                display: flex;
                align-items: baseline;
                gap: 0.4rem;
            }
            .uncertainty-value strong {
                font-size: 1.5rem;
                font-variant-numeric: tabular-nums;
            }
            .muted {
                color: var(--pico-muted-color);
                font-size: 0.9rem;
            }
            .range-track {
                position: relative;
                height: 0.55rem;
                border-radius: 999px;
                background: color-mix(in srgb, var(--pico-muted-color) 20%, transparent);
                margin-top: 0.7rem;
            }
            .range-fill {
                position: absolute;
                top: 0;
                bottom: 0;
                border-radius: inherit;
                background: linear-gradient(
                    90deg,
                    color-mix(in srgb, var(--pico-primary) 75%, transparent),
                    color-mix(in srgb, var(--pico-del-color) 75%, transparent)
                );
            }
            .range-endpoints {
                display: flex;
                justify-content: space-between;
                font-size: 0.78rem;
                color: var(--pico-muted-color);
                margin-top: 0.25rem;
                font-variant-numeric: tabular-nums;
            }

            @media (max-width: 720px) {
                .headline-row {
                    grid-template-columns: minmax(0, 1fr);
                }
            }
        `,
    ];
}
