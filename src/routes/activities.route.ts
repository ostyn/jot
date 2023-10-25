import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import * as data from '../assets/data.json';
import { base } from '../baseStyles';

@customElement('activities-route')
export class ActivitiesRoute extends LitElement {
    activities = data.activities;

    render() {
        return html` <article>
            <section>
                ${this.activities.map((activity) => {
                    return html`${activity.emoji}`;
                })}
            </section>
            <mood-edit mood.two-way="mood"></mood-edit>
        </article>`;
    }
    static styles = [base];
}
