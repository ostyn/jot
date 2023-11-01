import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { Mood } from '../interfaces/mood.interface';
import { moods } from '../stores/moods.store';

@customElement('moods-route')
export class MoodsRoute extends LitElement {
    @state()
    moods: Mood[] = moods.getState().userCreated;
    constructor() {
        super();
        moods.subscribe((state) => {
            this.moods = state.userCreated;
        });
    }

    render() {
        return html`<article>
            <section>
                ${this.moods.map((mood) => {
                    return html`<span class="moods-mood">${mood.emoji}</span>`;
                })}
            </section>
            <mood-edit mood.two-way="mood"></mood-edit>
            <button @click=${() => moods.getState().addMood()}>add</button>
        </article>`;
    }
    static styles = [
        base,
        css`
            .moods-mood {
                font-size: 2rem;
                cursor: pointer;
            }
        `,
    ];
}
