import {
    css,
    html,
    LitElement,
    nothing,
    PropertyValueMap,
    TemplateResult,
} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { base } from '../../baseStyles';

export let Sheet: ActionSheet;
@customElement('action-sheet')
export class ActionSheet extends LitElement {
    @state() dragPosition: number | undefined;
    @state() sheetHeight!: number; // in vh
    sheetContents!: HTMLElement;
    sheet!: HTMLElement;
    @state()
    data: any;
    onClose?: (data?: any) => void;
    @state()
    isShown: boolean = false;
    type!: {
        getActionSheet(data: any, submit: (data: any) => void): TemplateResult;
    };

    constructor() {
        super();
        if (!Sheet) Sheet = this;
    }
    public open(options: {
        type: {
            getActionSheet(
                data: any,
                submit: (data: any) => void
            ): TemplateResult;
        };
        data?: any;
        onClose?: (data?: any) => void;
    }) {
        this.data = options.data;
        this.type = options.type;
        this.onClose = options.onClose;
        this.setSheetHeight(50);
        this.setIsSheetShown(true);
    }
    private setSheetHeight = (value: number) => {
        this.sheetHeight = Math.max(0, Math.min(100, value));
        this.sheetContents.style.height = `${this.sheetHeight}vh`;

        if (this.sheetHeight === 100) {
            this.sheetContents.classList.add('fullscreen');
        } else {
            this.sheetContents.classList.remove('fullscreen');
        }
    };

    private setIsSheetShown = (isShown: boolean) => {
        this.isShown = isShown;
    };

    protected firstUpdated(
        _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
    ): void {
        this.sheet = this.shadowRoot!.querySelector('#sheet') as HTMLElement;
        this.sheetContents = this.sheet.querySelector(
            '.contents'
        ) as HTMLElement;
        const draggableArea = this.sheet.querySelector(
            '.draggable-area'
        ) as HTMLElement;

        window.addEventListener('keyup', (event: any) => {
            if (event.key === 'Escape') {
                this.setIsSheetShown(false);
            }
        });

        const touchPosition = (event: any) =>
            event.touches ? event.touches[0] : event;

        const onDragStart = (event: any) => {
            this.dragPosition = touchPosition(event).pageY;
            this.sheetContents.classList.add('not-selectable');
            draggableArea.style.cursor = document.body.style.cursor =
                'grabbing';
        };

        const onDragMove = (event: any) => {
            if (this.dragPosition === undefined) return;

            const y = touchPosition(event).pageY;
            const deltaY = this.dragPosition - y;
            const deltaHeight = (deltaY / window.innerHeight) * 100;

            this.setSheetHeight(this.sheetHeight + deltaHeight);
            this.dragPosition = y;
        };

        const onDragEnd = () => {
            this.dragPosition = undefined;
            this.sheetContents.classList.remove('not-selectable');
            draggableArea.style.cursor = document.body.style.cursor = '';

            if (this.sheetHeight < 25) {
                this.setIsSheetShown(false);
            } else if (this.sheetHeight > 75) {
                this.setSheetHeight(100);
            } else {
                this.setSheetHeight(50);
            }
        };

        draggableArea.addEventListener('mousedown', onDragStart);
        draggableArea.addEventListener('touchstart', onDragStart);

        window.addEventListener('mousemove', onDragMove);
        window.addEventListener('touchmove', onDragMove);

        window.addEventListener('mouseup', onDragEnd);
        window.addEventListener('touchend', onDragEnd);
    }
    public close(data?: any, submittingData = false) {
        this.setIsSheetShown(false);
        if (submittingData && this.onClose) this.onClose(data);
    }
    private getActionSheet() {
        return this.type.getActionSheet(this.data, (data: any) => {
            this.close(data, true);
        });
    }

    render() {
        return html`<span>
            <div
                id="sheet"
                class="sheet"
                aria-hidden=${!this.isShown}
                role="dialog"
            >
                <div class="overlay" @click=${this.close}></div>

                <div class="contents">
                    <header class="controls">
                        <div class="draggable-area">
                            <div class="draggable-thumb"></div>
                        </div>
                    </header>

                    <main class="body">
                        <article class="content">
                            ${this.isShown ? this.getActionSheet() : nothing}
                        </article>
                    </main>
                </div>
            </div>
        </span>`;
    }
    static styles = [
        base,
        css`
            :host {
                --background: #fff;
                --foreground: #000;
                --divider: #dcdcdc;
                --overlay: #000000;
            }

            textarea {
                resize: none;
            }

            .sheet {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-end;

                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 1000;
                visibility: visible;
                transition:
                    opacity 0.3s,
                    visibility 0.3s;
            }

            .sheet[aria-hidden='true'] {
                opacity: 0;
                visibility: hidden;
                pointer-events: none;
            }

            .sheet .overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: -1;
                background: var(--overlay);
                opacity: 0.6;
            }

            .sheet .contents {
                padding-top: 1rem;
                border-radius: 1rem 1rem 0 0;
                background: var(--background-color);

                overflow-y: hidden;

                --default-transitions: transform 0.3s, border-radius 0.3s;

                transition: var(--default-transitions);
                transform: translateY(0);

                max-width: 36rem;
                width: 100%;
                max-height: 100vh;
                height: 30vh;
            }

            .sheet .contents:not(.not-selectable) {
                transition:
                    var(--default-transitions),
                    height 0.3s;
            }

            .sheet .contents.fullscreen {
                border-radius: 0;
            }

            .sheet[aria-hidden='true'] .contents {
                transform: translateY(100%);
            }

            .sheet .controls {
                position: fixed;
                top: calc(0.5rem - 0.125rem);
                left: calc(50% - 27px);
            }

            .sheet .draggable-area {
                height: 1.5rem;
                width: 3rem;
                cursor: grab;
            }

            .sheet .draggable-thumb {
                width: inherit;
                height: 0.25rem;
                background: var(--divider);
                border-radius: 0.125rem;
            }

            .sheet .body {
                height: 100%;
                overflow-y: auto;
            }
        `,
    ];
}
