import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../baseStyles';
import './activity.component';

@customElement('activity-detail')
export class ActivityDetailComponent extends LitElement {
    render() {
        return html`<span class="activity-detail"><slot></slot></span>`;
    }
    static styles = [
        base,
        css`
            .activity-detail {
                display: inline-flex;
                padding-top: 0.125rem;
                padding-bottom: 0.125rem;
                padding-left: 0.5rem;
                padding-right: 0.5rem;
                margin: 0.125rem;
                background-color: rgba(147, 197, 253, 1);
                color: #000000;
                font-size: 0.75rem;
                line-height: 1rem;
                text-align: center;
                white-space: pre-wrap;
                align-items: center;
                border-radius: 0.375rem;
            }
        `,
    ];
}
