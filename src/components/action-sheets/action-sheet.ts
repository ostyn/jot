import {
    css,
    html,
    LitElement,
    nothing,
    PropertyValueMap,
    TemplateResult,
} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { disableBodyScroll, enableBodyScroll } from 'body-scroll-lock-upgrade';
import TinyGesture from 'tinygesture';
import { base } from '../../baseStyles';

export let Sheet: ActionSheet;
@customElement('action-sheet')
export class ActionSheet extends LitElement {
    @state() dragPosition: number | undefined;
    @state() sheetHeight: number = 0; // in vh
    sheetContents: Ref<HTMLInputElement> = createRef();
    controls: Ref<HTMLInputElement> = createRef();
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
        if (this.isShown) this.close();
        disableBodyScroll(this, { allowTouchMove: () => true });
        this.data = options.data;
        this.type = options.type;
        this.onClose = options.onClose;
        this.setSheetHeight(50);
        this.isShown = true;
    }
    private setSheetHeight = (value: number) => {
        this.sheetHeight = Math.max(0, Math.min(100, value));
        if (this.sheetContents.value)
            if (this.sheetHeight === 100) {
                this.sheetContents.value.classList.add('fullscreen');
            } else {
                this.sheetContents.value.classList.remove('fullscreen');
            }
    };

    protected firstUpdated(
        _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
    ): void {
        const gesture = new TinyGesture(this.controls.value || this, {});

        window.addEventListener('keyup', (event: any) => {
            if (event.key === 'Escape') {
                this.close();
            }
        });

        const touchPosition = (event: any) =>
            event.touches ? event.touches[0] : event;

        const onDragStart = (event: any) => {
            this.dragPosition = touchPosition(event).pageY;
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

            if (this.sheetHeight < 25) {
                this.close();
            } else if (this.sheetHeight > 75) {
                this.setSheetHeight(100);
            } else {
                this.setSheetHeight(50);
            }
        };
        gesture.on('panstart', onDragStart);
        gesture.on('panmove', onDragMove);
        gesture.on('panend', onDragEnd);
        gesture.on('swipeup', () => {
            this.setSheetHeight(100);
        });
        gesture.on('swipedown', () => {
            if (this.sheetHeight <= 50) {
                this.close();
            } else {
                this.setSheetHeight(50);
            }
        });
    }
    public close(data?: any, submittingData = false) {
        enableBodyScroll(this);
        this.isShown = false;
        if (submittingData && this.onClose) this.onClose(data);
    }
    private getActionSheet() {
        return this.type.getActionSheet(this.data, (data: any) => {
            this.close(data, true);
        });
    }

    render() {
        return html`<span>
            <div class="sheet" aria-hidden=${!this.isShown} role="dialog">
                <div class="overlay" @click=${this.close}></div>

                <div
                    class="contents"
                    ${ref(this.sheetContents)}
                    style=${styleMap({ height: `${this.sheetHeight}vh` })}
                >
                    <header class="controls" ${ref(this.controls)}>
                        <div class="draggable-area">
                            <div class="draggable-thumb"></div>
                        </div>
                    </header>

                    <main class="body">
                        ${this.isShown ? this.getActionSheet() : nothing}
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
                border-radius: 1rem 1rem 0 0;
                background: var(--card-background-color);

                overflow-y: hidden;

                --default-transitions: transform 0.3s, border-radius 0.3s;

                transition: var(--default-transitions);
                transform: translateY(0);

                max-width: 36rem;
                width: 100%;
                max-height: 100vh;
                height: 30vh;
            }

            .sheet .contents.fullscreen {
                border-radius: 0;
            }

            .sheet[aria-hidden='true'] .contents {
                transform: translateY(100%);
            }

            .sheet .controls {
                cursor: grabbing;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 2rem;
                top: calc(0.5rem - 0.125rem);
                width: 100%;
                text-align: center;
                text-align: -webkit-center;
            }

            .sheet .draggable-area {
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
                display: flex;
                align-items: stretch;
                flex-direction: column;
                height: calc(100% - 2rem);
                overflow-y: auto;
                padding: 0 1rem;
            }
        `,
    ];
}
