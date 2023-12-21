import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { addMonths, format } from 'date-fns';
import { base } from '../baseStyles';
import { dispatchEvent, Events } from '../utils/Helpers';

@customElement('month-control')
export class MonthControlComponent extends LitElement {
    @property({ attribute: false }) date: Date = new Date();
    public monthName?: string;
    showStreakMessage: boolean = false;
    stats?: {
        currentStreak: number;
        longestStreak: number;
        streaks: number[];
        todayInStreak: boolean;
        withinCurrentStreak: boolean;
    };
    private syncDisplayWithDate() {
        this.monthName = format(this.date, 'LLLL');
        this.showStreakMessage =
            this.date.getMonth() == new Date().getMonth() &&
            this.date.getFullYear() == new Date().getFullYear();
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
    getStats = () => {
        this.stats = undefined; //this.statsService.getStreakSummary(); TODO Fix Stats
    };
    private dispatchMonthChangedEvent(newDate: Date) {
        dispatchEvent(this, Events.monthChange, newDate);
    }
    render() {
        this.syncDisplayWithDate();
        this.getStats();
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
                    ${this.showStreakMessage && this.stats?.todayInStreak
                        ? html`<span class="streak-stats">
                              <jot-icon name="TrendingUp"></jot-icon>
                              ${this.stats?.currentStreak}
                          </span>`
                        : nothing}
                </div>
            </span>

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
