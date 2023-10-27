import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import * as data from '../assets/data.json';
import { base } from '../baseStyles';
import '../components/activity.component';
import { Activity } from '../interfaces/activity.interface';

@customElement('activities-route')
export class ActivitiesRoute extends LitElement {
    activities = data.activities as Activity[];

    render() {
        return html` <article>
            <section>
                ${this.activities.map((activity) => {
                    return html`<activity-component
                        .activity=${activity}
                        .showName=${true}
                    ></activity-component>`;
                })}
            </section>
            <mood-edit mood.two-way="mood"></mood-edit>
        </article>`;
    }
    static styles = [base];
}
