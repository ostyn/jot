import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { ActionSheetController } from './action-sheet-controller';
import './mood.sheet';

@customElement('action-sheet')
export class ActionSheetComponent extends LitElement {
    @state()
    public hideSheet = false;
    @state()
    public currentSheet: 'mood' | 'other' = 'mood';
    @state()
    data?: any;
    @state()
    onClose?: any;
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

    setSheet(newSheet) {
        this.currentSheet = newSheet;
    }
    setData(data) {
        this.data = data;
    }
    setOnClose(onClose) {
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
            case 'mood':
                return html` <mood-sheet .data=${this.data}></mood-sheet>`;
            case 'other':
                return html`EWOKS
                    <button @click=${() => ActionSheetController.close()}>
                        close me!
                    </button>`;
        }
    }
    close() {
        this.hideSheet = true;
        if (this.onClose) this.onClose();
    }
    render() {
        if (this.hideSheet) return;
        return html`<div class="popup">
            <div class="spacer" @click=${this.close}></div>
            <div class="centered-container">
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
            }
            .spacer {
                background-color: rgba(0, 0, 0, 0.4);
                min-height: 50vh;
            }
        `,
    ];
}
