import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import '../components/activity-grid.component';
import '../components/activity.component';
import { activities } from '../stores/activities.store';

@customElement('activities-route')
export class ActivitiesRoute extends LitElement {
    render() {
        return html`<activity-grid
            @activityClick=${async (e: any) =>
                ActionSheetController.open({
                    type: 'activityEdit',
                    data: await activities.getActivity(e.detail.id),
                })}
        ></activity-grid>`;
    }
    static styles = [base];
}
