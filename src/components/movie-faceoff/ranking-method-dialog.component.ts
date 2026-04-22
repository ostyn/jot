import { css, html, LitElement } from 'lit';
import { customElement, property, query } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { MovieFaceoffRankingAlgorithm } from '../../utils/movie-faceoff-rankings';

@customElement('ranking-method-dialog')
export class RankingMethodDialog extends LitElement {
    @property({ attribute: false })
    method?: MovieFaceoffRankingAlgorithm;

    @query('dialog')
    private dialogEl!: HTMLDialogElement;

    show() {
        this.dialogEl.showModal();
    }

    close() {
        this.dialogEl.close();
    }

    private onBackdropClick(event: Event) {
        if ((event.target as Element).nodeName === 'DIALOG') this.close();
    }

    render() {
        const method = this.method;
        return html`
            <dialog @click=${this.onBackdropClick}>
                <article>
                    <header>
                        <p class="eyebrow">Ranking method</p>
                        <h3>${method?.label || ''}</h3>
                    </header>
                    ${(method?.description || '')
                        .split('\n\n')
                        .filter(Boolean)
                        .map((p) => html`<p>${p}</p>`)}
                    <footer>
                        <button @click=${() => this.close()}>Close</button>
                    </footer>
                </article>
            </dialog>
        `;
    }

    static styles = [
        base,
        css`
            :host {
                display: contents;
            }
            dialog::backdrop {
                background: color-mix(in srgb, black 55%, transparent);
            }
            .eyebrow {
                margin: 0 0 0.15rem;
                font-size: 0.75rem;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--pico-muted-color);
            }
        `,
    ];
}
