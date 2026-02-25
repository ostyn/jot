import { css, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../../baseStyles';
import { ActivityDetail } from '../../interfaces/entry.interface';
import { StatsDetailEntry } from '../../interfaces/stats.interface';
import { activities } from '../../stores/activities.store';
import { dispatchEvent, Events } from '../../utils/Helpers';
import { Sheet } from './action-sheet';

@customElement('activity-detail-edit-sheet')
export class ActivityDetailEditSheet extends MobxLitElement {
    inputRef: Ref<HTMLElement> = createRef();
    @property({ attribute: false })
    public detail?: ActivityDetail;
    @property()
    public activityId!: string;
    @property()
    public closeMethod!: () => {};
    @state()
    workingDetail?: ActivityDetail;
    @state()
    newItem: string = '';
    @state()
    currentlySelectedIndex?: number = undefined;
    public hasDisconnected = false;
    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        return html`<activity-detail-edit-sheet
            .activityId=${data.id}
            .detail=${data.detail}
            .closeMethod=${data.close}
            @activityDetailSheetDismissed=${(e: any) => submit(e.detail)}
        ></activity-detail-edit-sheet>`;
    }
    protected firstUpdated(): void {
        // Initialize workingDetail: if detail is not an array and not 1, convert it
        if (!Array.isArray(this.detail)) {
            if (this.detail && this.detail !== 1) {
                this.workingDetail = [`${this.detail}`];
            } else {
                this.workingDetail = [];
            }
        } else {
            this.workingDetail = [...this.detail];
        }
        setTimeout(() => {
            this.inputRef?.value?.focus();
        }, 1);
    }
    disconnectedCallback() {
        // Emit the updated detail when sheet is dismissed
        if (!this.hasDisconnected) {
            this.hasDisconnected = true;
            dispatchEvent(
                this,
                Events.activityDetailSheetDismissed,
                this.workingDetail
            );
        }
    }
    add(amount: number) {
        const current =
            typeof this.workingDetail === 'number' ? this.workingDetail : 0;
        this.workingDetail = current + amount;
    }
    clear() {
        this.workingDetail = undefined;
        this.closeMethod();
    }
    addItemOrSubmit(e: any) {
        e.preventDefault();
        if (this.newItem !== '') {
            const items = Array.isArray(this.workingDetail)
                ? this.workingDetail
                : [];
            this.workingDetail = [...items, this.newItem];
            this.newItem = '';
        } else {
            Sheet.close();
        }
    }
    render() {
        const detail = this.workingDetail || [];

        const lowerCaseDetails = (Array.isArray(detail) ? detail : []).map(
            (str) => str.toLowerCase()
        );
        const filter = (detail: StatsDetailEntry) =>
            !lowerCaseDetails.includes(detail.text.toLowerCase()) &&
            detail.text.toLowerCase().includes(this.newItem.toLowerCase());

        return html`
            <header>
                <activity-component
                    .detail=${Array.isArray(detail) ? undefined : detail}
                    .showName=${true}
                    .activity=${activities.getActivity(this.activityId)}
                ></activity-component>
                <div>
                    <button
                        class="inline contrast"
                        @click=${() => {
                            if (
                                (Array.isArray(this.workingDetail) &&
                                    !this.workingDetail.length) ||
                                confirm('Continuing will clear existing detail')
                            ) {
                                this.workingDetail = [];
                                Sheet.close();
                            }
                        }}
                    >
                        ${'use number'}
                    </button>
                    <button class="inline secondary" @click=${this.clear}>
                        clear
                    </button>
                </div>
            </header>
            ${html`
                <h2>Details</h2>
                <div class="activity-details">
                    ${(Array.isArray(detail) ? detail : []).map(
                        (item, index) => html`
                            ${this.currentlySelectedIndex !== index
                                ? html`<activity-detail
                                      @click=${() => {
                                          this.currentlySelectedIndex = index;
                                      }}
                                      >${item}</activity-detail
                                  >`
                                : html`<textarea
                                          type="textarea"
                                          .value=${Array.isArray(detail)
                                              ? detail[index]
                                              : ''}
                                      ></textarea>
                                      <button
                                          @click=${() => {
                                              const inputEl =
                                                  this.renderRoot.querySelector(
                                                      'textarea'
                                                  ) as HTMLTextAreaElement;
                                              if (!inputEl) return;
                                              const newValue =
                                                  inputEl.value.trim();
                                              if (newValue === '') {
                                                  return;
                                              }
                                              if (
                                                  Array.isArray(
                                                      this.workingDetail
                                                  )
                                              ) {
                                                  this.workingDetail = [
                                                      ...this.workingDetail.slice(
                                                          0,
                                                          index
                                                      ),
                                                      newValue,
                                                      ...this.workingDetail.slice(
                                                          index + 1
                                                      ),
                                                  ];
                                              }
                                              this.currentlySelectedIndex =
                                                  undefined;
                                          }}
                                      >
                                          ✅
                                      </button>
                                      <button
                                          @click=${() => {
                                              if (
                                                  Array.isArray(
                                                      this.workingDetail
                                                  )
                                              ) {
                                                  this.workingDetail = [
                                                      ...this.workingDetail.slice(
                                                          0,
                                                          this
                                                              .currentlySelectedIndex as number
                                                      ),
                                                      ...this.workingDetail.slice(
                                                          (this
                                                              .currentlySelectedIndex as number) +
                                                              1
                                                      ),
                                                  ];
                                              }
                                              this.currentlySelectedIndex =
                                                  undefined;
                                          }}
                                      >
                                          ❌
                                      </button>`}
                        `
                    )}
                </div>
                <hr />
                <div>
                    <form @submit=${this.addItemOrSubmit}>
                        <input
                            class="width-64 inline"
                            ref="inputBox"
                            ${ref(this.inputRef)}
                            type="text"
                            .value=${this.newItem}
                            @input=${(e: any) =>
                                (this.newItem = e.target.value)}
                            placeholder="add item"
                        />
                        ${this.newItem
                            ? html`<button
                                  class="inline"
                                  @click=${this.addItemOrSubmit}
                              >
                                  <jot-icon name="Play"></jot-icon>
                              </button>`
                            : nothing}
                    </form>
                </div>
                <activity-detail-stats
                    @activityDetailClick=${(e: any) => {
                        const items = Array.isArray(this.workingDetail)
                            ? this.workingDetail
                            : [];
                        if (!items.includes(e.detail.text)) {
                            this.workingDetail = [...items, e.detail.text];
                        }
                        this.newItem = '';
                    }}
                    .activityId=${this.activityId}
                    .filter=${filter}
                ></activity-detail-stats>
            `}
        `;
    }
    static styles = [
        base,
        css`
            header {
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
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
                color: var(--pico-background-color);
                background-color: var(--pico-color);
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
            form {
                display: flex;
                gap: 4px;
            }
        `,
    ];
}
