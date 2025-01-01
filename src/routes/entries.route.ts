import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { Router, WebComponentInterface } from '@vaadin/router';
import { addMonths, lastDayOfMonth, parseISO } from 'date-fns';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';
import { Sheet } from '../components/action-sheets/action-sheet';
import { ActivityInfoSheet } from '../components/action-sheets/activity-info.sheet';
import { DateSheet } from '../components/action-sheets/date.sheet';
import '../components/entry.component';
import '../components/month-control.component';
import { entryDao } from '../dao/EntryDao';
import { Entry } from '../interfaces/entry.interface';
import { timer } from '../utils/Helpers';
import { go } from './route-config';

@customElement('entries-route')
export class EntriesRoute extends LitElement implements WebComponentInterface {
    @state() isLoading = true;
    currentDate: Date = new Date();
    public router?: Router;
    @state() scrollToDate?: number;
    @state() filteredEntries: Entry[] = [];
    gesture?: TinyGesture<this>;
    onAfterEnter() {
        window.addEventListener(
            'vaadin-router-location-changed',
            this.getParamsAndUpdate
        );
        this.getParamsAndUpdate();
        this.gesture = new TinyGesture(this, {
            threshold: (type, _self) =>
                Math.max(
                    25,
                    Math.floor(
                        0.3 *
                            (type === 'x'
                                ? window.innerWidth || document.body.clientWidth
                                : window.innerHeight ||
                                  document.body.clientHeight)
                    )
                ),
        });
        this.gesture.on('swiperight', (_event) => {
            this.goToMonth(addMonths(this.currentDate, -1));
        });
        this.gesture.on('swipeleft', (_event) => {
            this.goToMonth(addMonths(this.currentDate, 1));
        });
    }
    onAfterLeave() {
        window.removeEventListener(
            'vaadin-router-location-changed',
            this.getParamsAndUpdate
        );
        this.getParamsAndUpdate();
        this.gesture?.destroy();
    }
    private getParamsAndUpdate = async () => {
        this.isLoading = true;
        this.filteredEntries = [];
        const urlParams = new URLSearchParams(window.location.search);
        const dayParam = urlParams.get('day');
        const monthParam = urlParams.get('month');
        const yearParam = urlParams.get('year');
        const currentMonth = monthParam
            ? Number.parseInt(monthParam) - 1
            : new Date().getMonth();
        const currentYear = yearParam
            ? Number.parseInt(yearParam)
            : new Date().getFullYear();
        if (dayParam) {
            const currentDay = Number.parseInt(dayParam);
            this.currentDate = new Date(currentYear, currentMonth, currentDay);
            this.scrollToDate = currentDay;
        } else {
            this.currentDate = lastDayOfMonth(
                new Date(currentYear, currentMonth, 1)
            );
            this.scrollToDate = undefined;
        }
        // Wait at least 500ms for spinner
        const [_, entries] = await Promise.all([
            timer(500),
            entryDao.getEntriesFromYearAndMonth(
                this.currentDate.getFullYear(),
                this.currentDate.getMonth() + 1
            ),
        ]);

        this.isLoading = false;
        this.filteredEntries = [...entries];
    };
    shouldScrollToSelf(entry: Entry) {
        return parseISO(entry.date).getDate() === this.scrollToDate;
    }
    onMonthClick() {
        Sheet.open({
            type: DateSheet,
            data: { date: this.currentDate, type: 'month' },
            onClose: (e) => this.goToMonth(e.date),
        });
    }
    async onMonthChange(e: CustomEvent) {
        const date: Date = e.detail;
        this.goToMonth(date);
    }
    private goToMonth(date: Date) {
        if (this.isLoading) return;
        window.scrollTo({ top: 0 });
        go('entries', {
            queryParams: {
                month: date.getMonth() + 1,
                year: date.getFullYear(),
            },
        });
    }
    render() {
        return html`<section class="month-control-bar">
                <month-control
                    .date=${this.currentDate}
                    @monthChange=${this.onMonthChange}
                    @monthClick=${this.onMonthClick}
                ></month-control>
            </section>
            ${this.isLoading
                ? html`<article aria-busy="true"></article>`
                : html`<section class="entries">
                      ${this.filteredEntries.length
                          ? repeat(
                                this.filteredEntries,
                                (entry) => entry.id,
                                (entry: Entry) =>
                                    html`<entry-component
                                        .scrollToSelf=${this.shouldScrollToSelf(
                                            entry
                                        )}
                                        .entry="${entry}"
                                        @activityClick=${(e: any) => {
                                            Sheet.open({
                                                type: ActivityInfoSheet,
                                                data: {
                                                    id: e.detail.id,
                                                    date: new Date(
                                                        entry.date + 'T00:00:00'
                                                    ),
                                                },
                                            });
                                        }}
                                        @activityLongClick=${(e: any) => {
                                            Sheet.open({
                                                type: ActivityInfoSheet,
                                                data: {
                                                    id: e.detail.id,
                                                    date: new Date(
                                                        entry.date + 'T00:00:00'
                                                    ),
                                                },
                                            });
                                        }}
                                    ></entry-component>`
                            )
                          : html`<article class="emptyPlaceholder">
                                <h2>No Entries</h2>
                                <button
                                    class="newButton"
                                    @click=${() => go('entry')}
                                >
                                    <jot-icon name="Plus"></jot-icon>

                                    Add Entry
                                </button>
                            </article>`}
                  </section>`}
            <div class="sticky-buttons">
                <button class="inline contrast" @click=${() => go('search')}>
                    <jot-icon name="Search"></jot-icon>
                </button>
                <button class="inline" @click=${() => go('entry')}>
                    <jot-icon name="PenLine"></jot-icon>
                </button>
            </div>`;
    }
    static styles = [
        base,
        css`
            :host {
                overflow-x: hidden;
            }
            .entries {
                min-height: calc(100vh - 10rem);
            }
            .month-control-bar {
                position: sticky;
                z-index: 50;
                top: -0.1px;
                background-color: var(--pico-background-color);
                padding-top: 0.375rem;
                padding-bottom: 0.375rem;
                margin: 0.5rem;
            }
            .loader {
                height: 100vh;
            }
            .emptyPlaceholder {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .newButton {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                width: auto;
            }
        `,
    ];
}
