import { css, html, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { addMonths, format } from 'date-fns';
import { base } from '../baseStyles';
import { go } from '../routes/route-config';
import { dispatchEvent, Events } from '../utils/Helpers';

@customElement('month-control')
export class MonthControlComponent extends LitElement {
    @property({ attribute: false }) date: Date = new Date();
    public monthName?: string;

    private syncDisplayWithDate() {
        this.monthName = format(this.date, 'LLLL');
    }
    prev() {
        this.date = addMonths(this.date, -1);
        this.dispatchMonthChangedEvent(this.date);
    }
    next() {
        this.date = addMonths(this.date, 1);
        this.dispatchMonthChangedEvent(this.date);
    }
    triggerMonthClick() {
        dispatchEvent(this, Events.monthClick);
    }

    getSummaryUrl(date: Date) {
        const currentYear = date.getFullYear();
        const currentMonthPadded = String(date.getMonth() + 1).padStart(2, '0');
        const endDay = new Date(currentYear, date.getMonth() + 1, 0).getDate();
        return [
            `${currentYear}-${currentMonthPadded}-01`,
            `${currentYear}-${currentMonthPadded}-${endDay}`,
        ];
    }

    private dispatchMonthChangedEvent(newDate: Date) {
        dispatchEvent(this, Events.monthChange, newDate);
    }
    render() {
        this.syncDisplayWithDate();
        return html`<jot-icon
                class="next-prev-button"
                @click=${this.prev}
                name="ChevronLeft"
            ></jot-icon>
            <span class="month-header-container">
                <div class="month-header">
                    <span
                        @click=${this.triggerMonthClick}
                        class="month-header-date"
                        >${this.monthName} ${this.date.getFullYear()}</span
                    >
                </div>
            </span>
            <jot-icon
                name="ChartBar"
                @click=${() =>
                    go('summary', {
                        pathParams: this.getSummaryUrl(this.date),
                    })}
            ></jot-icon>
            <jot-icon
                class="next-prev-button"
                @click=${this.next}
                name="ChevronRight"
            ></jot-icon>`;
    }
    static styles = [
        base,
        css`
            :host {
                display: flex;
                user-select: none;
            }
            .next-prev-button {
                cursor: pointer;
            }
            .month-header-container {
                text-align: center;
                flex: 1 1 auto;
                align-self: center;
            }
            .month-header {
                display: inline-block;
                position: relative;
            }
            .month-header-date {
                cursor: pointer;
            }
            .streak-stats {
                position: absolute;
                margin-left: 12px;
                font-size: 0.875rem;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-weight: 700;
                filter: grayscale(1);
            }
            .streak-stats jot-icon {
                height: auto;
            }
        `,
    ];
}
