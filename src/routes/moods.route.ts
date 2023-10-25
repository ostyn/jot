import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import * as data from '../assets/data.json';
import base from '../baseStyles';

@customElement('moods-route')
export class MoodsRoute extends LitElement {
    moods = data.moods;

    render() {
        return html`<article>
            <section>
                ${this.moods.map((mood) => {
                    return html`<button>${mood.emoji}</button>`;
                })}
            </section>
            <mood-edit mood.two-way="mood"></mood-edit>
        </article>`;
        return;
    }
    static routeRender() {
        return html`<moods-route></moods-route>`;
    }
    static styles = [base];
}
