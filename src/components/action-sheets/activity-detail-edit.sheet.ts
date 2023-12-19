import { css, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../../baseStyles';
import { EntryEditStore } from '../../routes/entry-edit.route';
import { activities } from '../../stores/activities.store';
import { ActionSheetController } from './action-sheet-controller';

@customElement('activity-detail-edit-sheet')
export class ActivityDetailEditSheet extends MobxLitElement {
    inputRef: Ref<HTMLElement> = createRef();
    @property()
    public store?: EntryEditStore;
    @property()
    public activityId!: string;
    @state()
    newItem: string = '';
    @state()
    currentlySelectedIndex?: number = undefined;
    @state()
    editingArray?: boolean;
    @property()
    defaultIsArray?: boolean = false;
    static getActionSheet(
        data: any,
        _submit: (data: any) => void,
        _dismiss: () => void
    ): TemplateResult {
        return html`<header>Add some detail?</header>
            <activity-detail-edit-sheet
                .defaultIsArray=${data.defaultIsArray}
                .activityId=${data.id}
                .store=${data.store}
            ></activity-detail-edit-sheet>`;
    }
    protected firstUpdated(): void {
        let detail = this.store?.getActivityDetail(this.activityId);
        if (detail) this.editingArray = Array.isArray(detail);
        else this.editingArray = this.defaultIsArray;
        setTimeout(() => {
            this.inputRef?.value?.focus();
        }, 1);
    }
    add(amount: number) {
        this.store?.addToNumericActivityDetail(this.activityId, amount);
    }
    clear() {
        this.store?.clearActivityDetail(this.activityId);
        ActionSheetController.close();
    }
    addItemOrSubmit(e: any) {
        e.preventDefault();
        if (this.newItem !== '') {
            this.store?.addToArrayActivityDetail(this.activityId, this.newItem);
            this.newItem = '';
        } else {
            ActionSheetController.close();
        }
    }
    render() {
        const detail = this.store?.getActivityDetail(this.activityId) || [];
        return html`
            <header>
                <activity-component
                    .detail=${Array.isArray(detail) ? undefined : detail}
                    .showName=${true}
                    .activity=${activities.getActivity(this.activityId)}
                ></activity-component>
                <button class="inline secondary" @click=${this.clear}>
                    clear
                </button>
                <button
                    class="inline contrast"
                    @click=${() => {
                        const existingDetail = this.store?.getActivityDetail(
                            this.activityId
                        );
                        if (
                            (Array.isArray(existingDetail) &&
                                !existingDetail.length) ||
                            (!Array.isArray(existingDetail) &&
                                !existingDetail) ||
                            confirm('Continuing will clear existing detail')
                        ) {
                            this.store?.clearActivityDetail(this.activityId);
                            this.editingArray = !this.editingArray;
                        }
                    }}
                >
                    ${this.editingArray ? 'use number' : 'use text'}
                </button>
            </header>
            ${this.editingArray
                ? html`
                      <h2>Details</h2>
                      <div class="activity-details">
                          ${(Array.isArray(detail) ? detail : []).map(
                              (item, index) =>
                                  html`<div>
                                      ${this.currentlySelectedIndex !== index
                                          ? html`<activity-detail
                                                @click=${() => {
                                                    this.currentlySelectedIndex =
                                                        index;
                                                }}
                                                >${item}</activity-detail
                                            >`
                                          : html`<input
                                                    class="inline"
                                                    type="text"
                                                    .value=${Array.isArray(
                                                        detail
                                                    )
                                                        ? detail[index]
                                                        : ''}
                                                    @input=${(e: any) =>
                                                        this.store?.updateArrayActivityDetail(
                                                            this.activityId,
                                                            index,
                                                            e.target.value
                                                        )}
                                                /><button
                                                    class="inline"
                                                    @click=${() => {
                                                        this.store?.removeArrayActivityDetail(
                                                            this.activityId,
                                                            this
                                                                .currentlySelectedIndex as number
                                                        );
                                                        this.currentlySelectedIndex =
                                                            undefined;
                                                    }}
                                                >
                                                    ❌
                                                </button>`}
                                  </div>`
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
                                        <etch-icon name="Play"></etch-icon>
                                    </button>`
                                  : nothing}
                          </form>
                      </div>
                  `
                : html`<h2>Amount</h2>
                      <section class="content">
                          <section>
                              <button
                                  class="inline"
                                  @click=${() => this.add(-10)}
                              >
                                  -10
                              </button>
                              <button
                                  class="inline"
                                  @click=${() => this.add(-1)}
                              >
                                  -1
                              </button>
                              <button
                                  class="inline"
                                  @click=${() => this.add(-0.25)}
                              >
                                  -0.25
                              </button>
                              <button
                                  class="inline"
                                  @click=${() => this.add(0.25)}
                              >
                                  +0.25
                              </button>
                              <button
                                  class="inline"
                                  @click=${() => this.add(1)}
                              >
                                  +1
                              </button>
                              <button
                                  class="inline"
                                  @click=${() => this.add(10)}
                              >
                                  +10
                              </button>
                          </section>
                          <input
                              class="inline number-input"
                              ref="inputBox"
                              focus="true"
                              type="number"
                              .value=${`${detail}`}
                              @input=${(e: any) =>
                                  this.store?.setActivityDetail(
                                      this.activityId,
                                      e.target.value
                                  )}
                              placeholder="enter number"
                          />
                      </section>`}
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
            form {
                display: flex;
                gap: 4px;
            }
        `,
    ];
}
