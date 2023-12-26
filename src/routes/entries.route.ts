import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { animate, AnimateController } from '@lit-labs/motion';
import { AfterEnterObserver, Router } from '@vaadin/router';
import { addMonths, lastDayOfMonth, parseISO } from 'date-fns';
import TinyGesture from 'tinygesture';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import '../components/entry.component';
import '../components/month-control.component';
import { entryDao } from '../dao/EntryDao';
import { Entry } from '../interfaces/entry.interface';

@customElement('entries-route')
export class EntriesRoute extends LitElement implements AfterEnterObserver {
    @state() isLoading = true;
    currentDate: Date = new Date();
    public router?: Router;
    @state() scrollToDate?: number;
    @state() filteredEntries: Entry[] = [];
    gesture?: TinyGesture<this>;
    @state() animatingLeft: boolean = true;
    controller: AnimateController;
    constructor() {
        super();
        this.controller = new AnimateController(this, {
            defaultOptions: {
                keyframeOptions: {
                    duration: 400,
                },
            },
        });
    }
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

        const entries = await entryDao.getEntriesFromYearAndMonth(
            this.currentDate.getFullYear(),
            this.currentDate.getMonth() + 1
        );
        await this.controller.finished();
        this.filteredEntries = [...entries];
        this.isLoading = false;
    };
    shouldScrollToSelf(entry: Entry) {
        return parseISO(entry.date).getDate() === this.scrollToDate;
    }
    onMonthClick() {
        ActionSheetController.open({
            type: 'date',
            data: { date: this.currentDate, type: 'month' },
            onSubmit: (e) => this.goToMonth(e.date),
        });
    }
    async onMonthChange(e: CustomEvent) {
        const date: Date = e.detail;
        this.goToMonth(date);
    }
    private goToMonth(date: Date) {
        window.scrollTo({ top: 0 });
        const queryParams = new URLSearchParams({
            month: date.getMonth() + 1,
            year: date.getFullYear(),
        } as any).toString();
        this.animatingLeft = this.currentDate.getTime() - date.getTime() > 0;
        Router.go(`entries?${queryParams}`);
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
                ? html`<section
                      class="loader"
                      ${animate({
                          in: [
                              {
                                  transform: `translateX(${
                                      this.animatingLeft ? '-' : ''
                                  }100%)`,
                              },
                          ],
                          out: [
                              {
                                  transform: `translateX(${
                                      this.animatingLeft ? '' : '-'
                                  }100%)`,
                              },
                          ],
                          stabilizeOut: true,
                          skipInitial: true,
                      })}
                  >
                      <article aria-busy="true"></article>
                  </section>`
                : html`<section
                      class="entries"
                      ${animate({
                          in: [
                              {
                                  transform: `translateX(${
                                      this.animatingLeft ? '-' : ''
                                  }100%)`,
                              },
                          ],
                          out: [
                              {
                                  transform: `translateX(${
                                      this.animatingLeft ? '' : '-'
                                  }100%)`,
                              },
                          ],
                          stabilizeOut: true,
                          skipInitial: true,
                      })}
                  >
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
                                            ActionSheetController.open({
                                                type: 'activityInfo',
                                                data: {
                                                    id: e.detail.id,
                                                    date: entry.dateObject,
                                                },
                                            });
                                        }}
                                        @activityLongClick=${(e: any) => {
                                            ActionSheetController.open({
                                                type: 'activityInfo',
                                                data: {
                                                    id: e.detail.id,
                                                    date: entry.dateObject,
                                                },
                                            });
                                        }}
                                    ></entry-component>`
                            )
                          : html`<article class="emptyPlaceholder">
                                <h2>No Entries</h2>
                                <button
                                    class="newButton"
                                    @click=${() => Router.go('entry')}
                                >
                                    <jot-icon name="Plus"></jot-icon>

                                    Add Entry
                                </button>
                            </article>`}
                  </section>`}
            <div class="sticky-buttons">
                <button
                    class="inline contrast"
                    @click=${() => Router.go('search')}
                >
                    <jot-icon name="Search"></jot-icon>
                </button>
                <button class="inline" @click=${() => Router.go('entry')}>
                    <jot-icon name="PenLine"></jot-icon>
                </button>
            </div>`;
    }
    static styles = [
        base,
        css`
            .entries {
                min-height: calc(100vh - 10rem);
            }
            .month-control-bar {
                position: sticky;
                z-index: 50;
                top: -0.1px;
                background-color: var(--background-color);
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
