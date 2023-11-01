import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../baseStyles';
import '../components/activity-grid.component';
import '../components/activity.component';

@customElement('activities-route')
export class ActivitiesRoute extends LitElement {
    render() {
        return html`<activity-grid></activity-grid>`;
    }
    static styles = [base];
}
