import { css, html, LitElement, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { base } from '../../baseStyles';
import { ActivityDetail } from '../../interfaces/entry.interface';
import { activities } from '../../stores/activities.store';
import { dispatchEvent, Events, Helpers } from '../../utils/Helpers';

@customElement('activity-detail-edit-sheet')
export class ActivityDetailEditSheet extends LitElement {
    @state()
    public newDetail?: ActivityDetail;
    @property()
    public detail?: ActivityDetail;
    @property()
    public activityId!: string;
    public hasDisconnected = false;
    @state()
    editingNumber: boolean = true;
    static getActionSheet(
        data: any,
        submit: (data: any) => void,
        _dismiss: () => void
    ): TemplateResult {
        return html`<header>Add some detail?</header>
            <activity-detail-edit-sheet
                .activityId=${data.id}
                .detail=${data.detail}
                @textSheetDismissed=${(e: any) => submit(e.detail)}
            ></activity-detail-edit-sheet>`;
    }
    protected firstUpdated() {
        this.newDetail = this.detail;
        this.editingNumber =
            Helpers.isNumeric(this.newDetail) || this.newDetail === undefined;
    }
    disconnectedCallback() {
        // Was getting multiple of these
        if (!this.hasDisconnected) {
            this.hasDisconnected = true;
            dispatchEvent(this, Events.textSheetDismissed, this.newDetail);
        }
    }
    add(amount: number) {
        if (this.newDetail === undefined) this.newDetail = 0;
        if (Helpers.isNumeric(this.newDetail)) {
            this.newDetail = (this.newDetail as number) + amount;
        }
    }
    clear() {
        this.newDetail = undefined;
    }
    render() {
        return html`
            <header>
                <activity-component
                    .detail=${this.newDetail}
                    .showName=${true}
                    .activity=${activities.getActivity(this.activityId)}
                ></activity-component>
                <button class="inline secondary" @click=${() => this.clear()}>
                    clear
                </button>
            </header>
            ${this.editingNumber
                ? html`<section class="content">
                      <section>
                          <button class="inline" @click=${() => this.add(10)}>
                              +10
                          </button>
                          <button class="inline" @click=${() => this.add(1)}>
                              +1
                          </button>
                          <button class="inline" @click=${() => this.add(0.25)}>
                              +0.25
                          </button>
                          <button
                              class="inline"
                              @click=${() => this.add(-0.25)}
                          >
                              -0.25
                          </button>
                          <button class="inline" @click=${() => this.add(-1)}>
                              -1
                          </button>
                          <button class="inline" @click=${() => this.add(-10)}>
                              -10
                          </button>
                      </section>
                      <input
                          class="inline number-input"
                          ref="inputBox"
                          focus="true"
                          type="text"
                          .value=${this.newDetail || ''}
                          placeholder="enter number"
                      />
                  </section>`
                : nothing}
        `;
    }
    static styles = [
        base,
        css`
            :host,
            .content {
                display: flex;
                gap: 8px;
                flex-direction: column;
            }
            input.number-input {
                width: 15rem;
            }
            .stats-block {
                display: flex;
            }
            .stats-column {
                display: inline-block;
                width: 50%;
                user-select: none;
            }
            .stats-entry {
                padding: 0.75rem;
                cursor: pointer;
            }
            .stats-entry-datapoint {
                display: inline-flex;
                padding-top: 0;
                padding-bottom: 0;
                padding-left: 0.5rem;
                padding-right: 0.5rem;
                margin-right: 0.5rem;
                color: var(--background-color);
                background-color: var(--color);
                font-size: 0.75rem;
                line-height: 1rem;
                justify-content: center;
                align-items: center;
                border-radius: 9999px;
            }
            .activity-details {
                display: flex;
                flex-wrap: wrap;
            }
        `,
    ];
}
