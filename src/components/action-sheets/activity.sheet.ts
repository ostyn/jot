import { html, TemplateResult } from 'lit';

export class ActivitySheet {
    static getActionSheet(
        _data: any,
        submit: (data: any) => void
    ): TemplateResult {
        return html`<activity-grid
            @activityClick=${(data: any) => submit(data.detail.id)}
        ></activity-grid>`;
    }
}
