import { css, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import VanillaCalendar, { Options } from '@uvarov.frontend/vanilla-calendar';
import { dispatchEvent, Events } from '../utils/Helpers';
import calendarDark from '/node_modules/@uvarov.frontend/vanilla-calendar/build/themes/dark.min.css?inline';
import calendarLight from '/node_modules/@uvarov.frontend/vanilla-calendar/build/themes/light.min.css?inline';
import calendar from '/node_modules/@uvarov.frontend/vanilla-calendar/build/vanilla-calendar.min.css?inline';

@customElement('calendar-wrapper')
export class CalendarWrapperComponent extends MobxLitElement {
    @property()
    dateValues: { [key: string]: string } = {};
    calendar!: VanillaCalendar<HTMLElement, Partial<Options>>;

    protected firstUpdated(): void {
        const options: Partial<Options> = {
            settings: {
                iso8601: false,
                visibility: {
                    weekend: false,
                },
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
                    dispatchEvent(this, Events.dateSelect, {
                        date: (dates as string[])[0],
                    });
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
