import { css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { parseISO } from 'date-fns';
import { Calendar, type Options } from 'vanilla-calendar-pro';
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
        // If we have selected dates, start with the month of the first selected date
        let displayDate = this.startingDate;
        if (this.selectedDatesInitial.length > 0) {
            try {
                displayDate = parseISO(this.selectedDatesInitial[0]);
            } catch (e) {
                // Fall back to startingDate if parsing fails
            }
        }

        this.shownMonth = displayDate.getMonth();
        this.shownYear = displayDate.getFullYear();
        const options: Options = {
            type: this.type,
            firstWeekday: 0,
            selectedWeekends: [],
            dateToday: this.startingDate,
            selectedMonth: this.shownMonth as any,
            selectedYear: this.shownYear,
            selectionDatesMode: this.selectionDatesMode,
            ...(this.selectedDatesInitial.length > 0 && {
                selectedDates: this.selectedDatesInitial,
            }),
            onCreateDateEls: (self, dateEl) => {
                const dateValues = this.dateValues;
                const date = dateEl.getAttribute('data-vc-date') || '';
                if (dateValues[date] !== undefined) {
                    const btnEl = dateEl.querySelector(
                        '[data-vc-date-btn]'
                    ) as HTMLButtonElement;
                    const day = btnEl.innerHTML;
                    btnEl.style.flexDirection = 'column';
                    btnEl.innerHTML = `<span>${day}</span>
                      <span class="date-detail">${dateValues[date]}</span>`;
                }
            },
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
                    const dateEl = (event.target as HTMLElement).closest(
                        '[data-vc-date]'
                    );
                    if (dateEl) {
                        const dateStr = dateEl.getAttribute('data-vc-date');
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
                dispatchEvent(this, Events.viewChange, {
                    year: self.context.selectedYear,
                    month: self.context.selectedMonth,
                });
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
                    dispatchEvent(this, Events.viewChange, {
                        year,
                        month,
                    });
                }
            },
            onClickYear: (self: any) => {
                this.shownMonth = self.context.selectedMonth;
                this.shownYear = self.context.selectedYear;
                dispatchEvent(this, Events.viewChange, {
                    year: this.shownYear,
                    month: this.shownMonth,
                });
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
            .vc-date__btn {
                margin: 1px;
            }
            .vc-date__btn:has(.date-detail) {
                border: var(--pico-primary) 1px solid;
                border-radius: 12px;
            }
            .date-detail {
                color: var(--pico-contrast);
            }
        `,
    ];
}
