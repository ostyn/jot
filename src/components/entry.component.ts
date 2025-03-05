import { css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { Entry } from '../interfaces/entry.interface';
import { go } from '../routes/route-config';
import { activities } from '../stores/activities.store';
import { moods } from '../stores/moods.store';
import { DateHelpers } from '../utils/DateHelpers';
import { Sheet } from './action-sheets/action-sheet';
import { MapSheet } from './action-sheets/map.sheet';
import './activity.component';

@customElement('entry-component')
export class EntryComponent extends MobxLitElement {
    @property()
    public entry: Entry = {} as Entry;
    @property()
    public scrollToSelf = false;
    updated() {
        if (this.scrollToSelf) {
            setTimeout(
                () =>
                    this.scrollIntoView({
                        block: 'center',
                    }),
                1
            );
        }
    }
    private goToSelf() {
        go('entries', {
            queryParams: DateHelpers.getDateStringParts(this.entry.date),
        });
    }
    editEntry() {
        go('entry', { pathParams: [this.entry.id as string] });
    }
    render() {
        if (!this.entry) return nothing;
        const activityOrder = Object.keys(this.entry.activities).sort(
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

        const msSpentEditing = this.entry.editLog.reduce(
            (sum, entry) => sum + (entry?.duration ?? 0),
            0
        );
        return html`<article class="entry">
            <header class="entry-header">
                <hgroup>
                    <h2 class="entry-header-text" @click=${this.goToSelf}>
                        ${DateHelpers.stringDateToDate(this.entry.date)}
                    </h2>

                    <h3>${DateHelpers.stringDateToWeekDay(this.entry.date)}</h3>
                    ${this.entry.location?.lat
                        ? html`<jot-icon
                              name="MapPin"
                              @click=${() => {
                                  Sheet.open({
                                      type: MapSheet,
                                      data: {
                                          lat: this.entry.location?.lat,
                                          lon: this.entry.location?.lon,
                                      },
                                  });
                              }}
                          ></jot-icon>`
                        : nothing}
                </hgroup>
                <span
                    class="entry-header-emoji"
                    .title=${moods.getMood(this.entry.mood)?.name || ''}
                >
                    ${moods.getMood(this.entry.mood)?.emoji || ''}
                </span>
            </header>
            <section class="entry-activities">
                ${activityOrder.map((activityId) =>
                    activities.getActivity(activityId)
                        ? html`<activity-component
                              .activity=${activities.getActivity(activityId)}
                              .detail=${this.entry.activities[activityId]}
                              class="entry-activity"
                          ></activity-component>`
                        : nothing
                )}
            </section>
            ${this.entry.note != ''
                ? html`<section class="entry-note">${this.entry.note}</section>`
                : nothing}
            <section class="entry-footer">
                <button
                    class="inline outline contrast"
                    @click=${this.editEntry}
                >
                    edit
                </button>
                <div class="entry-footer-dates">
                    <span>
                        Entered
                        ${DateHelpers.dateToStringDate(
                            this.entry.editLog[0].date
                        )},
                        ${DateHelpers.dateToStringTime(
                            this.entry.editLog[0].date
                        )}<br />
                    </span>
                    ${this.entry?.editLog?.length > 1
                        ? html`<span>
                                  Updated
                                  ${DateHelpers.dateToStringDate(
                                      this.entry.editLog[
                                          this.entry.editLog.length - 1
                                      ].date
                                  )},
                                  ${DateHelpers.dateToStringTime(
                                      this.entry.editLog[
                                          this.entry.editLog.length - 1
                                      ].date
                                  )}<br />
                              </span>
                              ${msSpentEditing > 0
                                  ? html`<span>
                                        ${DateHelpers.duration(msSpentEditing)}
                                        spent editing
                                        ${this.entry.editLog.length > 1
                                            ? html`across
                                              ${this.entry.editLog.length}
                                              sessions`
                                            : nothing}
                                        <br />
                                    </span>`
                                  : nothing}`
                        : nothing}
                    ${['DAYLIO_IMPORT', 'DAYLIO'].includes(
                        this.entry.editLog[0].tool
                    )
                        ? html`<span>Imported from Daylio<br /></span>`
                        : nothing}
                </div>
            </section>
        </article>`;
    }
    static styles = [
        base,
        css`
            .entry {
                display: flex;
                gap: 16px;
                flex-direction: column;
            }
            .entry > * {
                margin-bottom: 0px;
            }

            .entry-header {
                padding: 16px;
                display: flex;
                vertical-align: middle;
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
                gap: 4px;
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
                color: var(--pico-secondary);
            }
        `,
    ];
}
