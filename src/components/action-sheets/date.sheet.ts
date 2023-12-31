import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { TypesCalendar } from '@uvarov.frontend/vanilla-calendar/src/types';
import { base } from '../../baseStyles';

@customElement('date-sheet')
export class DateSheet extends LitElement {
    @property()
    public date!: Date;
    @property()
    public type: TypesCalendar = 'default';
    @state()
    public newText!: string;
    public hasDisconnected = false;
    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        return html`<date-sheet
            .date=${data.date}
            .type=${data.type}
            @monthSelect=${(e: any) =>
                data.type === 'month' && submit(e.detail)}
            @dateSelect=${(e: any) =>
                (data.type === 'default' || data.type === undefined) &&
                submit(e.detail)}
        ></date-sheet>`;
    }
    protected firstUpdated() {
        this.date = this.date || new Date();
    }
    render() {
        return html`
            <calendar-wrapper
                .startingDate=${this.date}
                .type=${this.type}
            ></calendar-wrapper>
        `;
    }
    static styles = [
        base,
        css`
            :host {
                display: flex;
                justify-content: center;
            }
        `,
    ];
}
