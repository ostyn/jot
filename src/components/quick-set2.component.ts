import { css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { StatsDetailEntry } from '../interfaces/stats.interface';
import { EntryEditStore } from '../routes/entry-edit.route';
import { activities } from '../stores/activities.store';
import { Sheet } from './action-sheets/action-sheet';
import { ActivityDetailEditSheet } from './action-sheets/activity-detail-edit.sheet';

@customElement('quick-set2')
export class QuickSet2 extends MobxLitElement {
    public static latestValue?: QuickSet2;
    public static open(store: EntryEditStore, activityId: string) {
        document
            .querySelector('body')
            ?.appendChild(new QuickSet2(store, activityId));
    }
    public static close() {
        QuickSet2.latestValue?.disconnectedCallback();
    }
    constructor(
        public store: EntryEditStore,
        public activityId: string
    ) {
        super();
        QuickSet2.latestValue?.remove();
        QuickSet2.latestValue = this;
    }
    public disconnectedCallback() {
        QuickSet2.latestValue = undefined;
        this.remove();
    }
    add(amount: number) {
        this.store?.addToNumericActivityDetail(this.activityId, amount);
    }
    @state()
    mruDetails?: StatsDetailEntry[];
    @property()
    filter: (detail: StatsDetailEntry) => boolean = (_) => true;
    setupDetailLists() {
        const detail = this.store?.getActivityDetail(this.activityId) || [];

        const lowerCaseDetails = (Array.isArray(detail) ? detail : []).map(
            (str) => str.toLowerCase()
        );
        let detailStats = activities.getActivityDetailStats(
            this.activityId,
            (detail: StatsDetailEntry) =>
                !lowerCaseDetails.includes(detail.text.toLowerCase())
        );
        this.mruDetails = detailStats.mruDetails;
    }
    render() {
        const detail = this.store?.getActivityDetail(this.activityId);

        this.setupDetailLists();

        return html`
            <div class="menu">
                <jot-icon
                    class="close-button"
                    name="XCircle"
                    @click=${QuickSet2.close}
                ></jot-icon>
                <activity-component
                    class="activity"
                    .detail=${detail}
                    .showName=${true}
                    .activity=${activities.getActivity(this.activityId)}
                ></activity-component>
                <span
                    class="clear-button"
                    @click=${() => {
                        this.store.clearActivityDetail(this.activityId);
                        this.disconnectedCallback();
                    }}
                >
                    <jot-icon name="Trash2"></jot-icon>
                </span>
                <div class="activities">
                    ${this.mruDetails?.map(
                        (detail) =>
                            html`<div
                                @click=${() => {
                                    if (
                                        !Array.isArray(
                                            this.store.getActivityDetail(
                                                this.activityId
                                            )
                                        )
                                    )
                                        this.store.clearActivityDetail(
                                            this.activityId
                                        );
                                    this.store.addToArrayActivityDetail(
                                        this.activityId,
                                        detail.text
                                    );
                                }}
                                class="stats-entry"
                            >
                                <activity-detail
                                    >${detail.text}</activity-detail
                                >
                            </div>`
                    )}
                </div>
                <span class="positive-buttons">
                    <span class="amount-button" @click=${() => this.add(1)}>
                        +1
                    </span>

                    <span class="amount-button" @click=${() => this.add(0.25)}>
                        +¼
                    </span>
                    <span class="amount-button" @click=${() => this.add(10)}>
                        +10
                    </span>
                </span>
                <span class="negative-buttons">
                    <span class="amount-button" @click=${() => this.add(-1)}>
                        -1
                    </span>
                    <span class="amount-button" @click=${() => this.add(-0.25)}>
                        -¼
                    </span>

                    <span class="amount-button" @click=${() => this.add(-10)}>
                        -10
                    </span>
                </span>

                <jot-icon
                    class="text-button"
                    name="PenLine"
                    @click=${() => {
                        Sheet.open({
                            type: ActivityDetailEditSheet,
                            data: {
                                id: this.activityId,
                                store: this.store,
                            },
                        });
                        this.disconnectedCallback();
                    }}
                ></jot-icon>
            </div>
        `;
    }
    static styles = [
        base,
        css`
            .close-button {
                grid-area: close=button;
                cursor: pointer;
                text-align: right;
            }
            .activities {
                grid-area: activities;
                display: flex;
                flex-wrap: wrap;
            }
            .amount-button {
                width: 16px;
                user-select: none;
                cursor: pointer;
                font-size: 16px;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .text-button {
                cursor: pointer;
                grid-area: text-button;
                justify-content: center;
                display: flex;
            }
            .negative-buttons {
                grid-area: negative-buttons;
                justify-content: center;
                display: flex;
                width: 100%;
                gap: 32px;
            }
            .positive-buttons {
                grid-area: positive-buttons;
                justify-content: center;
                display: flex;
                width: 100%;
                gap: 32px;
            }
            .clear-button {
                cursor: pointer;
                grid-area: clear-button;
                justify-content: center;
                display: flex;
            }
            .activity {
                grid-area: activity;
                justify-content: center;
                display: flex;
            }
            .menu {
                display: grid;
                grid-template-areas:
                    'activity clear-button positive-buttons close-button'
                    'activity clear-button  negative-buttons text-button'
                    'activities activities activities activities';
                place-content: center space-around;
                padding: 8px;
                position: fixed;
                align-items: center;
                bottom: 62px;
                width: 100%;
                max-width: 36rem;
                justify-self: anchor-center;
                left: 0;
                z-index: 99;
                border-radius: 1rem 1rem 0 0;
                background: var(--pico-card-background-color);
                border-top: var(--pico-contrast) 1px solid;
                justify-content: space-between;
            }
        `,
    ];
}
