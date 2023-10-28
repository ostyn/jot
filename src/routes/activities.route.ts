import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import * as data from '../assets/data.json';
import { base } from '../baseStyles';
import '../components/activity-grid.component';
import '../components/activity.component';
import { Activity } from '../interfaces/activity.interface';

@customElement('activities-route')
export class ActivitiesRoute extends LitElement {
    activities = data.activities as Activity[];

    render() {
        return html`<activity-grid></activity-grid>`;
    }
    static styles = [base];
}
