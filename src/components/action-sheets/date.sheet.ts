import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import {
    endOfDay,
    endOfMonth,
    endOfWeek,
    endOfYear,
    startOfDay,
    startOfMonth,
    startOfWeek,
    startOfYear,
    subDays,
    subMonths,
    subYears,
} from 'date-fns';
import { TypesCalendar } from 'vanilla-calendar-pro';
import { base } from '../../baseStyles';
import { dispatchEvent, Events } from '../../utils/Helpers';

@customElement('date-sheet')
export class DateSheet extends LitElement {
    @property()
    public date!: Date;
    @property()
    public type: TypesCalendar = 'default';
    @property()
    public selectionMode: 'single' | 'range' = 'single';
    @property()
    public selectedDates: string[] = [];
    @state()
    public newText!: string;
    @state()
    public selectedStartDate: Date | null = null;
    public hasDisconnected = false;

    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        const selectionMode = data.selectionMode || 'single';
        return html`<date-sheet
            .date=${data.date}
            .type=${data.type}
            .selectionMode=${selectionMode}
            .selectedDates=${data.selectedDates || []}
            @monthSelect=${(e: any) =>
                data.type === 'month' && submit(e.detail)}
            @dateSelect=${(e: any) =>
                (data.type === 'default' || data.type === undefined) &&
                selectionMode === 'single' &&
                submit(e.detail)}
            @dateRangeSelect=${(e: any) =>
                (data.type === 'default' || data.type === undefined) &&
                selectionMode === 'range' &&
                submit(e.detail)}
        ></date-sheet>`;
    }

    protected firstUpdated() {
        this.date = this.date || new Date();
    }

    render() {
        const selectionDatesMode =
            this.selectionMode === 'range' ? 'multiple-ranged' : 'single';
        return html`
            <div class="date-sheet-container">
                <span class="selected-dates-info">
                    ${this.selectionMode === 'range'
                        ? this.selectedDates.length === 2
                            ? `From: ${this.selectedDates[0]} To: ${this.selectedDates[1]}`
                            : this.selectedDates.length === 1
                              ? `Selected: ${this.selectedDates[0]}`
                              : 'Select start and end dates'
                        : this.selectedDates.length === 1
                          ? `Selected date: ${this.selectedDates[0]}`
                          : 'No date selected'}
                </span>
                <calendar-wrapper
                    .startingDate=${this.date}
                    .type=${this.type}
                    .selectionDatesMode=${selectionDatesMode}
                    .selectedDatesInitial=${this.selectedDates}
                ></calendar-wrapper>
                ${this.selectionMode === 'range'
                    ? html`
                          <div class="range-info">
                              <p>
                                  Select start and end dates or choose a preset:
                              </p>
                              <div class="preset-buttons">
                                  <button
                                      @click=${() => this.selectPreset('today')}
                                  >
                                      Today
                                  </button>
                                  <button
                                      @click=${() =>
                                          this.selectPreset('last7days')}
                                  >
                                      Last 7 days
                                  </button>
                                  <button
                                      @click=${() =>
                                          this.selectPreset('lastWeek')}
                                  >
                                      Last week
                                  </button>
                                  <button
                                      @click=${() =>
                                          this.selectPreset('lastMonth')}
                                  >
                                      Last month
                                  </button>
                                  <button
                                      @click=${() =>
                                          this.selectPreset('last30days')}
                                  >
                                      Last 30 days
                                  </button>
                                  <button
                                      @click=${() =>
                                          this.selectPreset('thisMonth')}
                                  >
                                      This month
                                  </button>
                                  <button
                                      @click=${() =>
                                          this.selectPreset('lastYear')}
                                  >
                                      Last year
                                  </button>
                                  <button
                                      @click=${() =>
                                          this.selectPreset('thisYear')}
                                  >
                                      This year
                                  </button>
                              </div>
                              <button
                                  class="confirm-btn"
                                  @click=${() => this.confirmSingleDate()}
                              >
                                  Use selected date
                              </button>
                          </div>
                      `
                    : html``}
            </div>
        `;
    }

    private selectPreset(preset: string) {
        const today = new Date();
        let startDate: Date;
        let endDate: Date = endOfDay(today);

        switch (preset) {
            case 'today':
                startDate = startOfDay(today);
                break;
            case 'last7days':
                startDate = startOfDay(subDays(today, 6));
                break;
            case 'lastWeek':
                startDate = startOfDay(startOfWeek(subDays(today, 7)));
                endDate = endOfDay(endOfWeek(subDays(today, 7)));
                break;
            case 'last30days':
                startDate = startOfDay(subDays(today, 29));
                break;
            case 'lastMonth':
                startDate = startOfDay(startOfMonth(subMonths(today, 1)));
                endDate = endOfDay(endOfMonth(subMonths(today, 1)));
                break;
            case 'thisMonth':
                startDate = startOfDay(startOfMonth(today));
                break;
            case 'lastYear':
                startDate = startOfDay(startOfYear(subYears(today, 1)));
                endDate = endOfDay(endOfYear(subYears(today, 1)));
                break;
            case 'thisYear':
                startDate = startOfDay(startOfYear(today));
                break;
            default:
                return;
        }

        dispatchEvent(this, Events.dateRangeSelect, {
            startDate,
            endDate,
        });
    }

    private confirmSingleDate() {
        // Get the currently selected date from the calendar
        const calendarWrapper = this.shadowRoot?.querySelector(
            'calendar-wrapper'
        ) as any;
        if (calendarWrapper && calendarWrapper.calendar) {
            const context = calendarWrapper.calendar.context;
            if (context.selectedDates && context.selectedDates.length > 0) {
                const selectedDate = context.selectedDates[0];
                // Parse the ISO string date to create a Date object
                const dateObj = new Date(selectedDate);
                // Dispatch the event with the same date as both start and end
                dispatchEvent(this, Events.dateRangeSelect, {
                    startDate: dateObj,
                    endDate: dateObj,
                });
            }
        }
    }

    static styles = [
        base,
        css`
            :host {
                display: flex;
                justify-content: center;
            }
            .date-sheet-container {
                width: 100%;
            }
            .range-info {
                padding: 1rem;
                text-align: center;
                font-size: 0.9rem;
                color: var(--pico-secondary);
            }
            .preset-buttons {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
                margin: 1rem 0;
            }
            .confirm-btn {
                padding: 0.75rem 1.5rem;
                margin-top: 0.5rem;
            }
        `,
    ];
}
