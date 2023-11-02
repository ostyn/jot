import { html, TemplateResult } from 'lit';
import { Activity } from '../../interfaces/activity.interface';

export class ActivitySheet {
    static getActionSheet(
        data: any,
        submit: (data: any) => void,
        dismiss: () => void
    ): TemplateResult {
        return html`<header>Select an Activity</header>
            <activity-grid
                .onActivityClick=${(activity: Activity) => submit(activity.id)}
            ></activity-grid>`;
    }
}
