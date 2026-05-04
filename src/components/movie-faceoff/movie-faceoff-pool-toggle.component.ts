import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { MODES } from '../../utils/movie-faceoff-pools';

@customElement('movie-faceoff-pool-toggle')
export class MovieFaceoffPoolToggle extends LitElement {
    @property({ type: String })
    modeId = MODES[0].id;

    private onChange(event: Event) {
        const target = event.target as HTMLSelectElement;
        const next = target.value;
        if (this.modeId === next) return;
        this.dispatchEvent(
            new CustomEvent('pool-change', {
                detail: { modeId: next },
                bubbles: true,
                composed: true,
            })
        );
    }

    render() {
        return html`
            <label class="pool-picker">
                <span class="visually-hidden">Movie pool</span>
                <select
                    .value=${this.modeId}
                    @change=${(e: Event) => this.onChange(e)}
                >
                    ${MODES.map(
                        (mode) => html`
                            <option
                                value=${mode.id}
                                ?selected=${mode.id === this.modeId}
                            >
                                ${mode.label}
                            </option>
                        `
                    )}
                </select>
            </label>
        `;
    }

    static styles = [
        base,
        css`
            :host {
                display: block;
                width: fit-content;
            }
            .pool-picker {
                display: block;
                margin: 0;
            }
            select {
                margin: 0;
            }
            .visually-hidden {
                position: absolute;
                width: 1px;
                height: 1px;
                padding: 0;
                margin: -1px;
                overflow: hidden;
                clip: rect(0 0 0 0);
                white-space: nowrap;
                border: 0;
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
                select {
                    width: 100%;
                }
            }
        `,
    ];
}
