import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { activities } from '../../stores/activities.store';

@customElement('activity-info-sheet')
export class ActivityInfoSheet extends LitElement {
    @property()
    activityId!: string;
    @property()
    onChange!: (a: any) => {};
    daysWithActivity: number = 0;
    percentOfDays: number = 0;
    totalActivity: number = 0;

    static getActionSheet(
        data: any,
        _submit: (data: any) => void,
        _dismiss: () => void
    ): TemplateResult {
        return html`<header>Activity Info</header>
            <activity-info-sheet activityId=${data.id}></activity-info-sheet>`;
    }
    render() {
        return html` <header class="activity-info-header">
                <activity-component
                    .activity=${activities.getActivity(this.activityId)}
                ></activity-component
                ><span>
                    <div>This month: ${this.daysWithActivity}</div>
                    <div>Percent of days: ${this.percentOfDays}%</div>
                    <div>Total Count: ${this.totalActivity}</div>
                    <div>
                        Average per day:
                        ${(this.totalActivity / this.daysWithActivity).toFixed(
                            2
                        )}
                    </div>
                </span>
                <close-button click.trigger="controller.ok()"></close-button>
            </header>
            <calendar-wrapper
                if.bind="!loading"
                class="inline"
                dates.bind="relatedEntryMap"
                year.bind="year"
                month.bind="month"
                day.bind="day"
                activity-id.bind="activityId"
                on-date-select.call="onDateSelect(date)"
                on-month-change.call="onMonthChange(month, year)"
            ></calendar-wrapper>
            <ul>
                <li
                    class="activity-info-recent"
                    click.trigger="onDateSelect(key)"
                    repeat.for="[key, value] of relatedEntryMap"
                >
                    <span class="activity-info-recent-date">${'key'}</span>
                    <activity-detail
                        if.bind="isArray(value.activities.get(activityId))"
                        click.trigger="selectTextItem(textItem)"
                        repeat.for="textItem of value.activities.get(activityId)"
                        >${'textItem'}</activity-detail
                    >
                    <activity-detail else
                        >${activities.getActivity(
                            this.activityId
                        )}</activity-detail
                    >
                </li>
            </ul>
            <input
                if.bind="showLists"
                ref="inputBox"
                type="search"
                value.bind="filter"
                placeholder="search..."
            />
            <div if.bind="showLists" class="stats-block">
                <div class="stats-column">
                    <div
                        click.trigger="onDateSelect(detail.dates[0].date)"
                        repeat.for="detail of mfuDetails"
                        class="stats-entry"
                    >
                        <span class="stats-entry-datapoint"
                            >${'detail.count'}</span
                        ><activity-detail>${'detail.text'}</activity-detail>
                    </div>
                </div>
                <div if.bind="showLists" class="stats-column">
                    <div
                        click.trigger="onDateSelect(detail.dates[0].entry.date)"
                        repeat.for="detail of mruDetails"
                        class="stats-entry"
                    >
                        <span class="stats-entry-datapoint"
                            >${'detail.dates[0].date'}</span
                        ><activity-detail>${'detail.text'}</activity-detail>
                    </div>
                </div>
            </div>`;
    }
    static styles = [base, css``];
}
