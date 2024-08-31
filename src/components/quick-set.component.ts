import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { EntryEditStore } from '../routes/entry-edit.route';
import { Sheet } from './action-sheets/action-sheet';
import { ActivityDetailEditSheet } from './action-sheets/activity-detail-edit.sheet';

@customElement('quick-set')
export class QuickSet extends LitElement {
    public static latestValue?: QuickSet;
    constructor(
        public store: EntryEditStore,
        public activityId: string
    ) {
        super();
        QuickSet.latestValue?.remove();
        QuickSet.latestValue = this;
    }
    protected firstUpdated(): void {
        this.placeButtonsInArc(this);
    }
    public disconnectedCallback() {
        QuickSet.latestValue = undefined;
        this.remove();
    }
    buttons?: NodeListOf<Element>;
    add(amount: number) {
        this.store?.addToNumericActivityDetail(this.activityId, amount);
    }
    checkElementPosition(element: Element) {
        const rect = element.getBoundingClientRect();
        const screenWidth = window.innerWidth;

        if (rect.left < screenWidth / 2) {
            return -1; // Element is on the left side
        } else {
            return 1; // Element is on the right side
        }
    }
    placeButtonsInArc(target: HTMLElement) {
        this.buttons = this.shadowRoot?.querySelectorAll('.amount-button');

        const numberOfButtons = this.buttons?.length || 0;
        const radius = 100; // Adjust as needed
        const angleIncrement = 180 / (numberOfButtons - 1);

        const updateButtonPositions = () => {
            const buttons = this.buttons;
            buttons?.forEach((button, index) => {
                const angle =
                    (angleIncrement * index +
                        90 * this.checkElementPosition(this)) *
                    (Math.PI / 180) *
                    this.checkElementPosition(this); // Convert to radians and center the arc
                const x =
                    target.offsetLeft +
                    target.offsetWidth / 2 +
                    radius * Math.cos(angle) -
                    (button as HTMLElement).offsetWidth / 2 -
                    this.offsetLeft;
                const y =
                    target.offsetTop +
                    target.offsetHeight / 2 +
                    radius * Math.sin(angle) -
                    (button as HTMLElement).offsetHeight / 2 -
                    this.offsetTop;
                (button as HTMLElement).style.left = `${x}px`;
                (button as HTMLElement).style.top = `${y}px`;
            });
        };

        // Initial positioning
        updateButtonPositions();

        // Observe changes in the target element's position
        const observer = new MutationObserver(updateButtonPositions);
        observer.observe(target, {
            attributes: true,
            attributeFilter: ['style'],
        });
    }
    render() {
        return html`
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
            <span
                class="overlay"
                @click=${(e: Event) => {
                    this.disconnectedCallback();
                    e.stopPropagation();
                }}
            ></span>
        `;
    }
    static styles = [
        base,
        css`
            :host {
                display: block;
                z-index: 100000;
                position: absolute;
            }
            .amount-button {
                position: absolute;
                transform-origin: center;
                opacity: 0;
                width: auto;
                z-index: 99999;
                animation: moveOutward 0.2s forwards;
                border-radius: 100px;
                padding: 16px;
            }

            @keyframes moveOutward {
                0% {
                    opacity: 0;
                    transform: scale(0);
                }
                60% {
                    opacity: 1;
                    transform: scale(1.2);
                }
                100% {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            .overlay {
                z-index: -1;
                width: 100%;
                height: 100%;
                position: fixed;
                left: 0;
                top: 0;
                background-color: rgba(0, 0, 0, 0.3);
            }
        `,
    ];
}
