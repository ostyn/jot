import { html, TemplateResult } from 'lit';

export class ActivitySheet {
    static getActionSheet(
        _data: any,
        submit: (data: any) => void,
        _dismiss: () => void
    ): TemplateResult {
        return html`<header>Select an Activity</header>
            <activity-grid
                @activityClick=${(data: any) => submit(data.detail.id)}
            ></activity-grid>`;
    }
}
