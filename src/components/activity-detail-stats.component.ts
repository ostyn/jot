import { css, html, LitElement } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { StatsDetailEntry } from '../interfaces/stats.interface';
import { activities } from '../stores/activities.store';
import { dispatchEvent, Events } from '../utils/Helpers';

@customElement('activity-detail-stats')
export class ActivityDetailStatsComponent extends LitElement {
    @property()
    activityId: string = '';
    @state()
    mfuDetails?: StatsDetailEntry[];
    @state()
    mruDetails?: StatsDetailEntry[];
    @property()
    filter: string = '';
    setupDetailLists() {
        let detailStats = activities.getActivityDetailStats(
            this.activityId,
            this.filter
        );
        this.mfuDetails = detailStats.mfuDetails;
        this.mruDetails = detailStats.mruDetails;
    }
    render() {
        this.setupDetailLists();
        return html` <div class="stats-block">
            <div class="stats-column">
                ${this.mfuDetails?.map(
                    (detail) =>
                        html`<div
                            @click=${() =>
                                dispatchEvent(
                                    this,
                                    Events.activityDetailClick,
                                    detail
                                )}
                            class="stats-entry"
                        >
                            <span class="stats-entry-datapoint">
                                ${detail.count}
                            </span>
                            <activity-detail>${detail.text}</activity-detail>
                        </div>`
                )}
            </div>
            <div class="stats-column">
                ${this.mruDetails?.map(
                    (detail) =>
                        html` <div
                            @click=${() =>
                                dispatchEvent(
                                    this,
                                    Events.activityDetailClick,
                                    detail
                                )}
                            class="stats-entry"
                        >
                            <span class="stats-entry-datapoint">
                                ${detail.dates[0].date}
                            </span>
                            <activity-detail>${detail.text}</activity-detail>
                        </div>`
                )}
            </div>
        </div>`;
    }
    static styles = [
        base,
        css`
            .stats-block {
                display: flex;
            }
            .stats-column {
                display: inline-block;
                width: 50%;
                user-select: none;
            }
            .stats-entry {
                margin-top: 0.5rem;
                margin-bottom: 0.5rem;
                cursor: pointer;
            }
            .stats-entry-datapoint {
                display: inline-flex;
                padding-top: 0;
                padding-bottom: 0;
                padding-left: 0.5rem;
                padding-right: 0.5rem;
                margin-right: 0.5rem;
                color: var(--background-color);
                background-color: var(--color);
                font-size: 0.75rem;
                line-height: 1rem;
                justify-content: center;
                align-items: center;
                border-radius: 9999px;
                border-color: #000000;
            }
        `,
    ];
}
