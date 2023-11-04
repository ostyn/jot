import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { Router } from '@vaadin/router';
import { parseISO } from 'date-fns';
import { base } from '../baseStyles';
import { Activity } from '../interfaces/activity.interface';
import { Entry } from '../interfaces/entry.interface';
import { Mood } from '../interfaces/mood.interface';
import { activities } from '../stores/activities.store';
import { moods } from '../stores/moods.store';
import { DateHelpers } from '../utils/DateHelpers';
import { ActionSheetController } from './action-sheets/action-sheet-controller';
import './activity.component';

@customElement('entry-component')
export class EntryComponent extends LitElement {
    @property()
    public onDetailClick!: (data: any) => void;
    @property()
    public onActivityClick!: (data: any) => void;
    @property()
    public entry: Entry = {} as Entry;
    @property()
    public scrollToSelf = false;
    @state()
    activities: Activity[] = activities.getState().all;
    @state()
    currentMood?: Mood;
    firstUpdated() {
        this.currentMood = moods.getState().getMood(this.entry.mood);
        activities.subscribe((state) => {
            this.activities = state.all;
            this.render();
        });
        moods.subscribe(
            (state) => (this.currentMood = state.getMood(this.entry.mood))
        );
        if (this.scrollToSelf)
            setTimeout(
                () =>
                    this.scrollIntoView({
                        block: 'center',
                    }),
                1
            );
    }
    private getActivityById(activityId: string): Activity {
        return this.activities.find(
            (activity) => activity.id === activityId
        ) as Activity;
    }
    private goToSelf() {
        const date: Date = parseISO(this.entry.date);
        const queryParams = new URLSearchParams({
            month: date.getMonth() + 1,
            year: date.getFullYear(),
            day: date.getDate(),
        } as any).toString();
        Router.go(`entries?${queryParams}`);
    }
    render() {
        if (!this.entry) return nothing;
        this.entry.activitiesArray = Object.keys(this.entry.activities).sort(
            (a, b) => {
                let aVal = this.entry.activities[a];
                let bVal = this.entry.activities[b];
                if (Array.isArray(aVal) && Array.isArray(bVal)) {
                    let bCharLength = bVal
                        .map((val) => val.length)
                        .reduce((total, val) => total + val);
                    let aCharLength = aVal
                        .map((val) => val.length)
                        .reduce((total, val) => total + val);
                    return bCharLength - aCharLength;
                } else if (Array.isArray(aVal)) {
                    return -1;
                } else if (Array.isArray(bVal)) {
                    return 1;
                } else {
                    return bVal - aVal;
                }
                //TODO add tiebreaker using names
            }
        );
        return html`<article>
            <section class="entry-header">
                <hgroup>
                    <h2 class="entry-header-text" @click=${this.goToSelf}>
                        ${DateHelpers.stringDateToDate(this.entry.date)}
                    </h2>
                    <h3>${DateHelpers.stringDateToWeekDay(this.entry.date)}</h3>
                </hgroup>
                <span
                    class="entry-header-emoji"
                    .title=${this.currentMood?.name || ''}
                    @click=${() =>
                        ActionSheetController.open({
                            type: 'moodEdit',
                            data: this.currentMood,
                        })}
                >
                    ${this.currentMood?.emoji}
                </span>
            </section>
            <section class="entry-activities">
                ${(this.entry.activitiesArray || []).map((activityId) => {
                    return html`<activity-component
                        .activity=${this.getActivityById(activityId)}
                        .detail=${this.entry.activities[activityId]}
                        class="entry-activity"
                        @click=${() => this.onActivityClick(activityId)}
                        click.trigger="activityClicked(activity.id)"
                        .onDetailClick=${(data: any) =>
                            this.onDetailClick(data)}
                        .enableDetailClick=${!!this.onDetailClick}
                    ></activity-component>`;
                })}
            </section>
            ${this.entry.note != ''
                ? html`<section if.bind="entry.note != ''">
                      <p class="entry-note">${this.entry.note}</p>
                  </section>`
                : nothing}

            <section class="entry-footer">
                <button
                    class="inline outline contrast"
                    click.trigger="editEntry(entry.id)"
                >
                    edit
                </button>
                <div class="entry-footer-dates">
                    ${this.entry.created
                        ? html`<span if.bind="showCreatedDate">
                              Entered
                              ${DateHelpers.stringDateToDate(
                                  this.entry.created
                              )},
                              ${DateHelpers.stringDateToTime(
                                  this.entry.created
                              )}<br />
                          </span>`
                        : nothing}
                    ${this.entry.updated &&
                    this.entry.created !== this.entry.updated
                        ? html`<span>
                              Updated
                              ${DateHelpers.stringDateToDate(
                                  this.entry.updated
                              )},
                              ${DateHelpers.stringDateToTime(
                                  this.entry.updated
                              )}<br />
                          </span>`
                        : nothing}
                    ${this.entry.createdBy === 'DAYLIO_IMPORT'
                        ? html`<span>Imported from Daylio<br /></span>`
                        : nothing}
                </div>
            </section>
        </article>`;
    }
    static styles = [
        base,
        css`
            .entry-header {
                display: flex;
                vertical-align: middle;
                margin-bottom: 0px;
            }
            .entry-header hgroup {
                margin-bottom: 0px;
            }
            .entry-header-text {
                cursor: pointer;
            }
            .entry-header-emoji {
                margin-left: auto;
                font-size: 2.25rem;
                line-height: 2.25rem;
            }
            .entry-activities {
                display: flex;
                flex-wrap: wrap;
                align-items: center;
            }
            .entry-activity {
                align-items: center;
                cursor: pointer;
            }
            .entry-note-header {
                font-weight: 600;
            }
            .entry-note {
                white-space: pre-line;
                overflow-wrap: break-word;
            }
            .entry-footer {
                display: flex;
                justify-content: space-between;
                align-items: flex-end;
            }
            .entry-footer-dates {
                display: inline-block;
                text-align: right;
            }
            .entry-footer-dates {
                font-size: 0.75rem;
                line-height: 1rem;
                color: var(--secondary);
            }
        `,
    ];
}
