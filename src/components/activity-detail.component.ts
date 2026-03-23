import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { Location } from '../interfaces/entry.interface';
import { getLocationForDetailValue } from '../utils/ActivityDetailLocationHelpers';
import './activity.component';

@customElement('activity-detail')
export class ActivityDetailComponent extends LitElement {
    @property()
    public detailValue?: string | number;
    @state()
    private location?: Location;

    async connectedCallback() {
        super.connectedCallback();
        if (this.detailValue) {
            try {
                this.location = await getLocationForDetailValue(
                    this.detailValue
                );
            } catch (error) {
                console.error(
                    'Error loading location for detail:',
                    this.detailValue,
                    error
                );
            }
        }
    }

    private openLocationMap() {
        if (!this.location) return;
        // Dispatch event to parent to handle map opening
        this.dispatchEvent(
            new CustomEvent('location-pin-click', {
                detail: this.location,
                bubbles: true,
                composed: true,
            })
        );
    }

    render() {
        return html`<span class="activity-detail">
            ${this.location
                ? html`<button
                      class="location-pin"
                      title="Show location"
                      @click=${(e: Event) => {
                          e.stopPropagation();
                          this.openLocationMap();
                      }}
                  >
                      📍
                  </button>`
                : nothing}
            <span class="detail-text"><slot></slot></span>
        </span>`;
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
                gap: 4px;
            }

            .location-pin {
                background: none;
                border: none;
                padding: 0;
                margin: 0;
                cursor: pointer;
                font-size: 0.9em;
                line-height: 1;
                flex-shrink: 0;
            }

            .location-pin:hover {
                opacity: 0.7;
            }

            .detail-text {
                flex: 1;
            }
        `,
    ];
}
