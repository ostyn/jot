import { css, html, LitElement, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { getDaysInMonth } from 'date-fns';
import { base } from '../../baseStyles';
import { ActivityDetail, Entry } from '../../interfaces/entry.interface';
import { StatsDetailEntry } from '../../interfaces/stats.interface';
import { go } from '../../routes/route-config';
import { activities } from '../../stores/activities.store';
import { DateHelpers } from '../../utils/DateHelpers';
import '../activity-detail-stats.component';
import { Sheet } from './action-sheet';

@customElement('activity-info-sheet')
export class ActivityInfoSheet extends LitElement {
    @property()
    activityId!: string;
    @property()
    date!: Date;
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
    @state()
    filter = '';
    onActivityDetailClick = (activityId: string, detail: string) => {
        Sheet.close();
        go('search', {
            queryParams: {
                a: activityId,
                detail: detail,
            },
        });
    };
    static getActionSheet(
        data: any,
        _submit: (data: any) => void
    ): TemplateResult {
        return html`<activity-info-sheet
            activityId=${data.id}
            .date=${data.date}
        ></activity-info-sheet>`;
    }
    protected firstUpdated(): void {
        this.onMonthChange(this.date.getMonth(), this.date.getFullYear());
    }
    public onMonthChange = (month: number, year: number) => {
        this.dateValues = {};
        this.month = month;
        this.year = year;
        let activityStats = activities.stats.get(this.activityId);
        let affectedDates = activityStats?.dates;

        if (activityStats && activityStats.detailsUsed && this.selectedTextItem)
            affectedDates = activityStats.detailsUsed.get(
                this.selectedTextItem
            )?.dates;
        const entryDates = affectedDates?.filter((date) => {
            return (
                Number.parseInt(date.entry.date.split('-')[1]) == month + 1 &&
                Number.parseInt(date.entry.date.split('-')[0]) == year
            );
        });
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
    onDateSelect(date: string) {
        Sheet.close();
        go('entries', {
            queryParams: DateHelpers.getDateStringParts(date),
        });
    }
    render() {
        return html`
            <header class="activity-info-header">
                <activity-component
                    .showName=${true}
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
            </header>
            <calendar-wrapper
                class="inline"
                .startingDate=${this.date}
                .dateValues=${this.dateValues}
                @viewChange=${(e: any) =>
                    this.onMonthChange(e.detail.month, e.detail.year)}
                @dateSelect=${(e: any) =>
                    this.onDateSelect(DateHelpers.getDateString(e.detail.date))}
            ></calendar-wrapper>

            <ul>
                ${Array.from(this.relatedEntryMap?.entries() || []).map(
                    ([key, value]) =>
                        html`<li class="activity-info-recent">
                            <span
                                @click=${() => this.onDateSelect(value.date)}
                                class="activity-info-recent-date"
                                >${key}</span
                            >
                            ${Array.isArray(value.activities[this.activityId])
                                ? (
                                      value.activities[
                                          this.activityId
                                      ] as string[]
                                  ).map(
                                      (textItem) =>
                                          html`<activity-detail
                                              @click="${() =>
                                                  this.onActivityDetailClick(
                                                      this.activityId,
                                                      textItem
                                                  )}"
                                              >${textItem}</activity-detail
                                          >`
                                  )
                                : html`<activity-detail
                                      >${value.activities[
                                          this.activityId
                                      ]}</activity-detail
                                  >`}
                        </li>`
                )}
            </ul>
            ${activities.stats.get(this.activityId)?.detailsUsed
                ? html`<input
                          type="search"
                          @input=${(e: any) => {
                              this.filter = e.target.value;
                          }}
                          placeholder="search..."
                      />
                      <activity-detail-stats
                          @activityDetailClick=${(e: any) =>
                              this.onActivityDetailClick(
                                  this.activityId,
                                  e.detail.text
                              )}
                          .activityId=${this.activityId}
                          .filter=${(detail: StatsDetailEntry) =>
                              detail.text
                                  .toLowerCase()
                                  .includes(this.filter.toLowerCase())}
                      ></activity-detail-stats>`
                : nothing}
        `;
    }
    static styles = [
        base,
        css`
            .activity-info-header {
                display: flex;
            }
            .activity-info-recent {
                margin-top: 0.5rem;
                margin-bottom: 0.5rem;
                cursor: pointer;
                list-style: none;
            }
            .activity-info-recent-date {
                display: inline-flex;
                padding-top: 0;
                padding-bottom: 0;
                padding-left: 0.5rem;
                padding-right: 0.5rem;
                margin-right: 0.5rem;
                color: var(--pico-background-color);
                background-color: var(--pico-color);
                font-size: 0.75rem;
                line-height: 1rem;
                justify-content: center;
                align-items: center;
                border-radius: 9999px;
                border-color: #000000;
            }
        `,
    ];
}
