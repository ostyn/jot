import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getDaysInMonth } from 'date-fns';
import { base } from '../../baseStyles';
import { ActivityDetail, Entry } from '../../interfaces/entry.interface';
import { activities } from '../../stores/activities.store';
import { entries } from '../../stores/entries.store';

@customElement('activity-info-sheet')
export class ActivityInfoSheet extends LitElement {
    @property()
    activityId!: string;
    @property()
    onChange!: (a: any) => {};
    daysWithActivity: number = 0;
    percentOfDays: string = '';
    totalActivity: number = 0;
    @state()
    selectedTextItem?: string;
    relatedEntryMap?: Map<string, Entry>;
    daysElapsed?: number;
    month?: number;
    year?: number;
    @state()
    dateValues: any = {};

    static getActionSheet(
        data: any,
        _submit: (data: any) => void,
        _dismiss: () => void
    ): TemplateResult {
        return html`<header>Activity Info</header>
            <activity-info-sheet activityId=${data.id}></activity-info-sheet>`;
    }
    protected firstUpdated(): void {
        let date = new Date();
        this.onMonthChange(date.getMonth(), date.getFullYear());
    }
    public onMonthChange = (month: number, year: number) => {
        this.dateValues = {};
        this.month = month;
        this.year = year;
        let activityStats = entries.stats.get(this.activityId);
        let affectedDates = activityStats?.dates;

        if (activityStats && activityStats.detailsUsed && this.selectedTextItem)
            affectedDates = activityStats.detailsUsed.get(this.selectedTextItem)
                ?.dates;
        const entryDates = affectedDates?.filter(
            (date) =>
                date.entry.dateObject.getMonth() === month &&
                date.entry.dateObject.getFullYear() === year
        );
        this.relatedEntryMap = new Map();
        this.totalActivity = 0;
        for (let entryDate of entryDates || []) {
            this.relatedEntryMap.set(entryDate.date, entryDate.entry);
            const activityDetail: ActivityDetail =
                entryDate.entry.activities[this.activityId];
            this.totalActivity += Array.isArray(activityDetail)
                ? activityDetail.length
                : activityDetail;
            this.dateValues[entryDate.date] = Array.isArray(activityDetail)
                ? activityDetail.length
                : activityDetail;
        }

        this.daysElapsed = this.getDaysElapsedInMonth(month, year);
        this.daysWithActivity = this.relatedEntryMap.size;
        this.percentOfDays = this.daysElapsed
            ? ((this.daysWithActivity / this.daysElapsed) * 100).toFixed(2)
            : '0.00';
        console.log(
            this.daysWithActivity,
            this.daysElapsed,
            this.percentOfDays
        );
    };
    private getDaysElapsedInMonth(month: number, year: number): number {
        const currentDate = new Date();
        if (new Date(year, month, 1).getTime() > currentDate.getTime())
            return 0;
        if (
            month === currentDate.getMonth() &&
            year == currentDate.getFullYear()
        )
            return currentDate.getDate();
        else return getDaysInMonth(new Date(year, month, 1));
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
                .dateValues=${this.dateValues}
                @viewChange=${(e: any) =>
                    this.onMonthChange(e.detail.month, e.detail.year)}
                on-date-select.call="onDateSelect(date)"
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
