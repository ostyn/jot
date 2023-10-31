import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { animate } from '@lit-labs/motion';
import { base } from '../../baseStyles';
import { ActionSheetController } from './action-sheet-controller';
import './mood.sheet';

export enum SheetTypes {
    'mood',
    'activity',
}

@customElement('action-sheet')
export class ActionSheetComponent extends LitElement {
    @state()
    public hideSheet = true;
    @state()
    public currentSheet!: SheetTypes;
    @state()
    data?: any;
    @state()
    onClose?: (data: any) => void;
    actionSheetController: ActionSheetController;
    constructor() {
        super();
        this.actionSheetController = ActionSheetController.init(
            this.setSheet.bind(this),
            this.setData.bind(this),
            this.setOnClose.bind(this),
            this.hide.bind(this),
            this.show.bind(this)
        );
    }

    setSheet(newSheet: SheetTypes) {
        this.currentSheet = newSheet;
    }
    setData(data: any) {
        this.data = data;
    }
    setOnClose(onClose?: (data: any) => void) {
        this.onClose = onClose;
    }
    hide() {
        this.close();
    }
    show() {
        this.hideSheet = false;
    }
    getActionSheet() {
        switch (this.currentSheet) {
            case SheetTypes.mood:
                return html` <mood-sheet
                    .onChange=${(moodId: any) => this.close(moodId)}
                    currentMoodId=${this.data}
                ></mood-sheet>`;
            case SheetTypes.activity:
                return html`<activity-grid
                    .onActivityClick=${(activity: any) => this.close(activity)}
                ></activity-grid>`;
        }
    }
    close(data: any = undefined) {
        this.hideSheet = true;
        if (this.onClose) this.onClose(data);
    }
    render() {
        if (this.hideSheet) return;
        return html`<div
            class="popup"
            @click=${this.hide}
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
                max-width: 700px;
                margin-left: auto;
                margin-right: auto;
            }
            .content {
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
