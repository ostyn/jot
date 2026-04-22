import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { MovieFaceoffRankedMovie } from '../../interfaces/movie-faceoff.interface';
import { formatWinRate } from '../../utils/movie-detail-format';
import { sectionCardStyles } from './movie-detail-section.styles';

@customElement('movie-vote-stats')
export class MovieVoteStats extends LitElement {
    @property({ attribute: false })
    rating?: MovieFaceoffRankedMovie;

    render() {
        const won = this.rating?.winCount || 0;
        const lost = this.rating?.lossCount || 0;
        const elo = Math.round(this.rating?.rating || 1500);

        return html`
            <section class="surface-panel section-card">
                <header class="section-header">
                    <hgroup>
                        <p class="eyebrow">Vote history</p>
                        <h3>Your faceoffs</h3>
                    </hgroup>
                </header>
                <div class="stats-grid">
                    <article class="stat-card">
                        <p>Votes won</p>
                        <strong>${won}</strong>
                    </article>
                    <article class="stat-card">
                        <p>Votes lost</p>
                        <strong>${lost}</strong>
                    </article>
                    <article class="stat-card">
                        <p>Win rate</p>
                        <strong>${formatWinRate(won, lost)}</strong>
                    </article>
                    <article class="stat-card">
                        <p>Total faceoffs</p>
                        <strong>${won + lost}</strong>
                    </article>
                    <article class="stat-card">
                        <p>Elo rating</p>
                        <strong>${elo}</strong>
                    </article>
                </div>
            </section>
        `;
    }

    static styles = [
        base,
        sectionCardStyles,
        css`
            .stats-grid {
                display: grid;
                gap: 0.6rem;
                grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
            }
            .stat-card {
                display: grid;
                gap: 0.25rem;
                margin: 0;
                padding: 0.75rem 0.9rem;
                border-radius: var(--pico-border-radius);
                background: var(--pico-card-sectioning-background-color);
            }
            .stat-card p {
                margin: 0;
                font-size: 0.74rem;
                color: var(--pico-muted-color);
                text-transform: uppercase;
                letter-spacing: 0.06em;
            }
            .stat-card strong {
                font-size: 1.15rem;
                font-variant-numeric: tabular-nums;
            }
        `,
    ];
}
