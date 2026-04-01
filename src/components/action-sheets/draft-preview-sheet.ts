import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { formatDistance } from 'date-fns';
import { base } from '../../baseStyles';
import { Entry } from '../../interfaces/entry.interface';
import { dispatchEvent, Events } from '../../utils/Helpers';
import '../entry.component';
import { Sheet } from './action-sheet';

@customElement('draft-preview-sheet')
export class DraftPreviewSheet extends LitElement {
    @property({ attribute: false })
    draftEntry!: Entry & { draftTime: number };
    @property()
    submit!: (data: boolean) => void;
    hasDisconnected = false;
    static getActionSheet(
        data: Entry & { draftTime: number },
        submit: (data: boolean) => void
    ): TemplateResult {
        return html`<draft-preview-sheet
            .draftEntry=${data}
            .submit=${submit}
            @sheetDismissed=${(e: any) => {
                console.log('sheetDismissed', e.detail);
                submit(e.detail);
            }}
        ></draft-preview-sheet>`;
    }
    disconnectedCallback() {
        // Was getting multiple of these
        if (!this.hasDisconnected) {
            this.hasDisconnected = true;
            dispatchEvent(this, Events.sheetDismissed, false);
        }
    }
    protected firstUpdated() {
        Sheet.sheetHeight = 100;
    }
    render() {
        return html`Unsaved entry from
            ${formatDistance(
                new Date(this.draftEntry?.draftTime || 0),
                new Date(),
                { addSuffix: false }
            )}
            ago.
            <hr />
            <div role="group" class="action-sheet-buttons">
                <button
                    class="secondary"
                    @click=${() => {
                        this.hasDisconnected = true;
                        this.submit(false);
                    }}
                >
                    Discard Draft
                </button>
                <button
                    @click=${() => {
                        this.hasDisconnected = true;
                        this.submit(true);
                    }}
                >
                    Keep Editing
                </button>
            </div>

            <entry-component
                .entry=${this.draftEntry}
                .hideFooter=${true}
            ></entry-component> `;
    }
    static styles = [
        base,
        css`
            .action-sheet-buttons > button {
                flex-basis: 0;
            }
        `,
    ];
}
