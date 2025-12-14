// Mood component, just the emoji and an optional name tooltip along with an optional name. A click handler as well
import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { Mood } from '../interfaces/mood.interface';

@customElement('mood-component')
export class MoodComponent extends LitElement {
    @property({ type: Object })
    public mood?: Mood;
    @property({ type: Boolean })
    public showName: boolean = false;

    render() {
        if (!this.mood) return html``;
        return html`<span class="mood-container" title=${this.mood.name}>
            <span class="emoji"> ${this.mood.emoji} </span>
            ${this.showName
                ? html`<div class="mood-name">${this.mood.name}</div>`
                : ''}
        </span>`;
    }
    static styles = [
        base,
        css`
            .mood-container {
                cursor: pointer;
                display: inline-flex;
                flex-direction: column;
                align-items: center;
            }
            .emoji {
                font-size: 2.25rem;
                line-height: 2.25rem;
            }
            .mood-name {
                font-size: 0.875rem;
                margin-top: 0.25rem;
                text-align: center;
            }
        `,
    ];
}
