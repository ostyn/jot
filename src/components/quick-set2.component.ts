import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { EntryEditStore } from '../routes/entry-edit.route';
import { activities } from '../stores/activities.store';
import { Sheet } from './action-sheets/action-sheet';
import { ActivityDetailEditSheet } from './action-sheets/activity-detail-edit.sheet';

@customElement('quick-set2')
export class QuickSet2 extends MobxLitElement {
    public static latestValue?: QuickSet2;
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
    render() {
        const detail = this.store.getActivityDetail(this.activityId);

        return html`
            <div class="menu">
                <activity-component
                    .detail=${Array.isArray(detail) ? undefined : detail}
                    .showName=${true}
                    .activity=${activities.getActivity(this.activityId)}
                ></activity-component>
                <button
                    class="amount-button"
                    @click=${(e: Event) => {
                        this.store.clearActivityDetail(this.activityId);
                        this.disconnectedCallback();
                        e.stopPropagation();
                    }}
                >
                    🧹
                </button>

                <button
                    class="amount-button"
                    @click=${(e: Event) => {
                        this.add(-10);
                        e.stopPropagation();
                    }}
                >
                    -❿
                </button>
                <button
                    class="amount-button"
                    @click=${(e: Event) => {
                        this.add(-0.25);
                        e.stopPropagation();
                    }}
                >
                    -¼
                </button>
                <button
                    class="amount-button"
                    @click=${(e: Event) => {
                        this.add(-1);
                        e.stopPropagation();
                    }}
                >
                    ➖
                </button>
                <button
                    class="amount-button"
                    @click=${(e: Event) => {
                        this.add(1);
                        e.stopPropagation();
                    }}
                >
                    ➕
                </button>

                <button
                    class="amount-button"
                    @click=${(e: Event) => {
                        this.add(0.25);
                        e.stopPropagation();
                    }}
                >
                    +¼
                </button>
                <button
                    class="amount-button"
                    @click=${(e: Event) => {
                        this.add(10);
                        e.stopPropagation();
                    }}
                >
                    +❿
                </button>
                <button
                    class="amount-button"
                    @click=${(e: Event) => {
                        Sheet.open({
                            type: ActivityDetailEditSheet,
                            data: {
                                id: this.activityId,
                                store: this.store,
                                defaultIsArray: true,
                            },
                        });
                        this.disconnectedCallback();
                        e.stopPropagation();
                    }}
                >
                    💬
                </button>
            </div>
        `;
    }
    static styles = [
        base,
        css`
            .menu {
                position: fixed;
                bottom: 48px;
                width: 100%;
                display: flex;
                left: 0;
                z-index: 99;
                gap: 16px;
                border-radius: 1rem 1rem 0 0;
                background: var(--card-background-color);
            }
        `,
    ];
}
