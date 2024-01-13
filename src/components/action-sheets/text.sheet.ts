import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { base } from '../../baseStyles';
import { dispatchEvent, Events } from '../../utils/Helpers';

@customElement('text-sheet')
export class TextSheet extends LitElement {
    inputRef: Ref<HTMLElement> = createRef();
    @property()
    public text?: string;
    @state()
    public newText!: string;
    public hasDisconnected = false;
    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        return html`<text-sheet
            .text=${data}
            @textSheetDismissed=${(e: any) => submit(e.detail)}
        ></text-sheet>`;
    }
    protected firstUpdated() {
        this.newText = this.text || '';
        this?.inputRef?.value?.focus();
    }
    disconnectedCallback() {
        // Was getting multiple of these
        if (!this.hasDisconnected) {
            this.hasDisconnected = true;
            dispatchEvent(this, Events.textSheetDismissed, this.newText);
        }
    }
    render() {
        return html`
            <textarea
                ${ref(this.inputRef)}
                name="text"
                attach-focus
                class="text-prompt-input"
                .value=${this.newText as string}
                @input=${(e: any) => (this.newText = e.target.value)}
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
