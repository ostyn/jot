import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { Sheet } from '../components/action-sheets/action-sheet';
import { ActivityEditSheet } from '../components/action-sheets/activity-edit.sheet';
import { ActivityInfoSheet } from '../components/action-sheets/activity-info.sheet';
import '../components/activity-grid.component';
import '../components/activity.component';
import { activities } from '../stores/activities.store';

@customElement('activities-route')
export class ActivitiesRoute extends LitElement {
    render() {
        return html`<article class="activityHeader">
                <header>Activities</header>
            </article>
            <activity-grid
                @activityClick=${async (e: any) =>
                    Sheet.open({
                        type: ActivityEditSheet,
                        data: await activities.getActivity(e.detail.id),
                    })}
                @activityLongClick=${(e: any) => {
                    Sheet.open({
                        type: ActivityInfoSheet,
                        data: {
                            id: e.detail.id,
                            date: new Date(),
                        },
                    });
                }}
            ></activity-grid>`;
    }
    static styles = [
        base,
        css`
            .activityHeader {
                padding-bottom: 0;
            }
        `,
    ];
}
