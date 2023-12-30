import { html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { StatsDetailEntry } from '../../interfaces/stats.interface';
import { entries } from '../../stores/entries.store';
import { dispatchEvent, Events } from '../../utils/Helpers';

@customElement('activity-detail-select-sheet')
export class ActivityDetailSelectSheet extends LitElement {
    @property()
    activityId!: string;
    @state()
    details!: string[];
    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        return html`<header>Select a Detail</header>
            <activity-detail-select-sheet
                .activityId=${data}
                @activityDetailSelected=${(e: any) => submit(e.detail)}
            ></activity-detail-select-sheet>`;
    }
    clickDetail(detail: string) {
        dispatchEvent(this, Events.activityDetailSelected, detail);
    }
    protected firstUpdated() {
        this.details = Array.from(
            (
                (entries.stats.get(this.activityId) as any).detailsUsed as Map<
                    string,
                    StatsDetailEntry
                >
            ).keys()
        );
    }
    render() {
        return this.details?.length
            ? this.details.map(
                  (detail) =>
                      html`<activity-detail
                          @click=${() => this.clickDetail(detail)}
                          >${detail}</activity-detail
                      >`
              )
            : html`<span>No details</span>`;
    }
    static styles = [base];
}
