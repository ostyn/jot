import { html, TemplateResult } from 'lit';

export class ActivitySheet {
    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        return html`<activity-grid
            .focusedActivityIdList=${[...data.focusedActivityIdList]}
            @activityClick=${(data: any) => submit(data.detail.id)}
        ></activity-grid>`;
    }
}
