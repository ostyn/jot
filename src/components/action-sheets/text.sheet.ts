import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { base } from '../../baseStyles';
import { dispatchEvent, Events } from '../../utils/Helpers';
import { Sheet } from './action-sheet';

type TextSheetData = string | { text?: string; initialHeight?: number };

@customElement('text-sheet')
export class TextSheet extends LitElement {
    private inputRef: Ref<HTMLTextAreaElement> = createRef();

    @property()
    public text?: string;

    @property({ type: Number })
    public initialHeight = 100;

    @state()
    public newText = '';

    private hasDisconnected = false;

    static getActionSheet(
        data: TextSheetData | undefined,
        submit: (data: string) => void
    ): TemplateResult {
        const text = typeof data === 'string' ? data : data?.text || '';
        const initialHeight =
            typeof data === 'object' && typeof data?.initialHeight === 'number'
                ? data.initialHeight
                : 100;
        return html`<text-sheet
            .text=${text}
            .initialHeight=${initialHeight}
            @textSheetDismissed=${(e: CustomEvent<string>) =>
                submit(e.detail)}
        ></text-sheet>`;
    }
    protected override firstUpdated() {
        Sheet.sheetHeight = this.initialHeight;
        this.newText = this.text || '';
        setTimeout(() => {
            this.inputRef.value?.focus();
        }, 1);
    }
    override disconnectedCallback() {
        if (!this.hasDisconnected) {
            this.hasDisconnected = true;
            dispatchEvent(this, Events.textSheetDismissed, this.newText);
        }
        super.disconnectedCallback();
    }
    render() {
        return html`
            <textarea
                ${ref(this.inputRef)}
                name="text"
                attach-focus
                class="text-prompt-input"
                .value=${this.newText as string}
                @input=${(e: Event) =>
                    (this.newText = (e.target as HTMLTextAreaElement).value)}
            ></textarea>
        `;
    }
    static styles = [
        base,
        css`
            :host {
                height: 100%;
            }
            .text-prompt-input {
                height: calc(100% - 1.5rem);
            }
        `,
    ];
}
