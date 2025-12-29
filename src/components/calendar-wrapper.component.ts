import { css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { parseISO } from 'date-fns';
import { Calendar, Options } from 'vanilla-calendar-pro';
import { TypesCalendar } from 'vanilla-calendar-pro';
import calendar from 'vanilla-calendar-pro/styles/index.css?inline';
import calendarLayout from 'vanilla-calendar-pro/styles/layout.css?inline';
import calendarDark from 'vanilla-calendar-pro/styles/themes/dark.css?inline';
import calendarLight from 'vanilla-calendar-pro/styles/themes/light.css?inline';
import { dispatchEvent, Events } from '../utils/Helpers';

@customElement('calendar-wrapper')
export class CalendarWrapperComponent extends MobxLitElement {
    @property()
    startingDate = new Date();
    @property()
    type: TypesCalendar = 'default';
    @property()
    selectionDatesMode: 'multiple-ranged' | 'single' | 'multiple' = 'single';
    @property()
    dateValues: { [key: string]: string } = {};
    @property()
    selectedDatesInitial: string[] = [];
    calendar!: Calendar;
    shownMonth!: number;
    shownYear!: number;
    protected updated() {
        this.calendar.update();
    }
    protected firstUpdated(): void {
        this.shownMonth = this.startingDate.getMonth();
        this.shownYear = this.startingDate.getFullYear();
        const options: Partial<Options> = {
            type: this.type,
            dateToday: this.startingDate,
            selectionDatesMode: this.selectionDatesMode,
            ...(this.selectedDatesInitial.length > 0 && {
                selectedDates: this.selectedDatesInitial,
            }),
            onClickDate: (self: any, event: MouseEvent) => {
                // Handle range selection - check if we have a complete range (2 dates, even if the same)
                if (
                    this.selectionDatesMode === 'multiple-ranged' &&
                    self.context.selectedDates &&
                    self.context.selectedDates.length === 2 &&
                    self.context.selectedDates[0] &&
                    self.context.selectedDates[1]
                ) {
                    try {
                        const startDate = parseISO(
                            self.context.selectedDates[0]
                        );
                        const endDate = parseISO(self.context.selectedDates[1]);
                        dispatchEvent(this, Events.dateRangeSelect, {
                            startDate,
                            endDate,
                        });
                    } catch (e) {
                        console.warn('Error parsing selected dates:', e);
                    }
                } else {
                    // Single date selection
                    const dateEl = (event.target as HTMLElement).closest(
                        '[data-date]'
                    );
                    if (dateEl) {
                        const dateStr = dateEl.getAttribute('data-date');
                        if (dateStr) {
                            const date = parseISO(dateStr);
                            dispatchEvent(this, Events.dateSelect, {
                                date,
                            });
                        }
                    }
                }
            },
            onClickArrow: (self: any) => {
                this.shownMonth =
                    self.context.displayYear === this.shownYear
                        ? self.context.displayMonth
                        : this.shownMonth;
                this.shownYear = self.context.displayYear;
                this.onViewChange();
            },
            onClickMonth: (self: any) => {
                // Use the calendar's current selected month and year
                const year =
                    self.context.selectedYear || self.context.displayYear;
                const month =
                    self.context.selectedMonth !== undefined
                        ? self.context.selectedMonth
                        : self.context.displayMonth;

                if (
                    month !== undefined &&
                    month !== null &&
                    year !== undefined
                ) {
                    this.shownMonth = month;
                    this.shownYear = year;
                    dispatchEvent(this, Events.monthSelect, {
                        date: new Date(year, month, 1),
                    });
                }
            },
            onClickYear: (self: any) => {
                this.shownYear = self.context.displayYear;
                this.onViewChange();
            },
        };

        const calendarElement = this.shadowRoot?.querySelector('#calendar');
        if (calendarElement) {
            this.calendar = new Calendar(
                calendarElement as HTMLElement,
                options
            );
            this.calendar.init();
        }
    }
    private onViewChange() {
        dispatchEvent(this, Events.viewChange, {
            year: this.shownYear,
            month: this.shownMonth,
        });
    }
    protected render() {
        return html`<input style="display:none" id="dateinput" />
            <div id="calendar"></div>`;
    }
    static styles = [
        unsafeCSS(calendar),
        unsafeCSS(calendarDark),
        unsafeCSS(calendarLight),
        unsafeCSS(calendarLayout),
        css`
            .vanilla-calendar-day__btn {
                margin: 1px;
            }
            .vanilla-calendar-day__btn:has(.date-detail) {
                border: var(--pico-primary) 1px solid;
                border-radius: 12px;
            }
            .date-detail {
                color: var(--pico-contrast);
            }
        `,
    ];
}
