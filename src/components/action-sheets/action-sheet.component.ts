import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { animate } from '@lit-labs/motion';
import { base } from '../../baseStyles';
import { ActionSheetController } from './action-sheet-controller';
import { ActivityDetailSelectSheet } from './activity-detail-select.sheet';
import { ActivityEditSheet } from './activity-edit.sheet';
import { ActivitySheet } from './activity.sheet';
import './mood-edit.sheet';
import { MoodEditSheet } from './mood-edit.sheet';
import './moods.sheet';
import { MoodsSheet } from './moods.sheet';

const SheetMapping = {
    ['mood']: MoodsSheet,
    ['activity']: ActivitySheet,
    ['moodEdit']: MoodEditSheet,
    ['activityEdit']: ActivityEditSheet,
    ['activityDetailSelect']: ActivityDetailSelectSheet,
};
export type SheetType = keyof typeof SheetMapping;

@customElement('action-sheet')
export class ActionSheetComponent extends LitElement {
    @state()
    public hideSheet = true;
    @state()
    public currentSheet!: SheetType;
    @state()
    data?: any;
    @state()
    onSubmit?: (data: any) => void;
    @state()
    onDismiss?: () => void;
    actionSheetController: ActionSheetController;
    constructor() {
        super();
        this.actionSheetController = ActionSheetController.init(
            this.setSheet.bind(this),
            this.setData.bind(this),
            this.setOnSubmit.bind(this),
            this.setOnDismiss.bind(this),
            this.hide.bind(this),
            this.show.bind(this)
        );
    }

    setSheet(newSheet: SheetType) {
        this.currentSheet = newSheet;
    }
    setData(data: any) {
        this.data = data;
    }
    setOnSubmit(onSubmit?: (data: any) => void) {
        this.onSubmit = onSubmit;
    }
    setOnDismiss(onDismiss?: () => void) {
        this.onDismiss = onDismiss;
    }
    hide() {
        this.hideSheet = true;
    }
    show() {
        this.hideSheet = false;
    }
    getActionSheet() {
        return SheetMapping[this.currentSheet].getActionSheet(
            this.data,
            this.submit.bind(this),
            this.dismiss.bind(this)
        );
    }
    submit(data: any = undefined) {
        this.hideSheet = true;
        if (this.onSubmit) this.onSubmit(data);
    }
    dismiss() {
        this.hideSheet = true;
        if (this.onDismiss) this.onDismiss();
    }
    render() {
        if (this.hideSheet) return nothing;
        return html`<div
            class="popup"
            @click=${this.dismiss}
            ${animate({
                in: [
                    {
                        transform: 'translateY(100%)',
                        opacity: 0,
                    },
                ],
                out: [
                    {
                        transform: 'translateY(100%)',
                        opacity: 0,
                    },
                ],
            })}
        >
            <div class="spacer"></div>
            <div
                class="centered-container"
                @click=${(e: Event) => {
                    e.stopImmediatePropagation();
                }}
            >
                <article class="content">${this.getActionSheet()}</article>
            </div>
        </div>`;
    }
    static styles = [
        base,
        css`
            main {
                overflow-y: hidden;
            }
            .popup {
                overflow-y: scroll;
                width: 100%;
                height: 100%;
                z-index: 999999;
                position: fixed;
                bottom: 0;
            }
            .popup {
                -ms-overflow-style: none; /* IE and Edge */
                scrollbar-width: none; /* Firefox */
            }
            .popup::-webkit-scrollbar {
                display: none;
            }
            .centered-container {
                max-width: 36rem;
                margin-left: auto;
                margin-right: auto;
            }
            .content {
                filter: drop-shadow(0 -0.25rem 0.5rem rgba(0, 0, 0, 0.5));
                min-height: 50vh;
                margin-top: 0px;
                margin-bottom: 0px;
            }
            .spacer {
                min-height: 50vh;
            }
        `,
    ];
}
