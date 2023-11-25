import { css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import VanillaCalendar, { Options } from '@uvarov.frontend/vanilla-calendar';
import { parseISO } from 'date-fns';
import { dispatchEvent, Events } from '../utils/Helpers';
import calendarDark from '/node_modules/@uvarov.frontend/vanilla-calendar/build/themes/dark.min.css?inline';
import calendarLight from '/node_modules/@uvarov.frontend/vanilla-calendar/build/themes/light.min.css?inline';
import calendar from '/node_modules/@uvarov.frontend/vanilla-calendar/build/vanilla-calendar.min.css?inline';

@customElement('calendar-wrapper')
export class CalendarWrapperComponent extends MobxLitElement {
    @property()
    startingDate = new Date();
    @property()
    dateValues: { [key: string]: string } = {};
    calendar!: VanillaCalendar<HTMLElement, Partial<Options>>;
    shownMonth!: number;
    shownYear!: number;
    protected updated() {
        this.calendar.update();
    }
    protected firstUpdated(): void {
        this.shownMonth = this.startingDate.getMonth();
        this.shownYear = this.startingDate.getFullYear();
        const options: Partial<Options> = {
            settings: {
                iso8601: false,
                visibility: {
                    weekend: false,
                },
            },
            date: {
                today: this.startingDate,
            },
            actions: {
                getDays: (day, date, _HTMLElement, HTMLButtonElement) => {
                    if (this.dateValues[date] !== undefined) {
                        HTMLButtonElement.style.flexDirection = 'column';
                        HTMLButtonElement.innerHTML = `
                      <span>${day}</span>
                      <span class="date-detail">${this.dateValues[date]}</span>
                    `;
                    }
                },
                clickDay: (_event, dates) => {
                    const date = parseISO((dates as string[])[0]);
                    if (this.shownMonth === date.getMonth())
                        dispatchEvent(this, Events.dateSelect, {
                            date: (dates as string[])[0],
                        });
                    else {
                        this.shownMonth = date.getMonth();
                        this.shownYear = date.getFullYear();
                        this.onViewChange();
                    }
                },
                clickArrow: (_event, year, month) => {
                    this.shownMonth = month;
                    this.shownYear = year;
                    this.onViewChange();
                },
                clickMonth: (_event, month) => {
                    this.shownMonth = month;
                    this.onViewChange();
                },
                clickYear: (_event, year) => {
                    this.shownYear = year;
                    this.onViewChange();
                },
            },
        };

        const calendarElement = this.shadowRoot?.querySelector('#calendar');
        if (calendarElement) {
            this.calendar = new VanillaCalendar(
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
        css`
            .vanilla-calendar-day__btn {
                margin: 1px;
            }
            .vanilla-calendar-day__btn:has(.date-detail) {
                border: var(--primary) 1px solid;
                border-radius: 12px;
            }
            .date-detail {
                color: var(--contrast);
            }
        `,
    ];
}
