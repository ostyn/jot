import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import * as data from '../assets/data.json';
import { base } from '../baseStyles';
import { Mood } from '../interfaces/mood.interface';

@customElement('moods-route')
export class MoodsRoute extends LitElement {
    moods: Mood[] = data.moods as Mood[];

    render() {
        return html`<article>
            <section>
                ${this.moods.map((mood) => {
                    return html`<span class="moods-mood">${mood.emoji}</span>`;
                })}
            </section>
            <mood-edit mood.two-way="mood"></mood-edit>
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
