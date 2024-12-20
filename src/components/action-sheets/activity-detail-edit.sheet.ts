import { css, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../../baseStyles';
import { StatsDetailEntry } from '../../interfaces/stats.interface';
import { EntryEditStore } from '../../routes/entry-edit.route';
import { activities } from '../../stores/activities.store';
import { QuickSet2 } from '../quick-set2.component';
import { Sheet } from './action-sheet';

@customElement('activity-detail-edit-sheet')
export class ActivityDetailEditSheet extends MobxLitElement {
    inputRef: Ref<HTMLElement> = createRef();
    @property()
    public store!: EntryEditStore;
    @property()
    public activityId!: string;
    @state()
    newItem: string = '';
    @state()
    currentlySelectedIndex?: number = undefined;
    static getActionSheet(
        data: any,
        _submit: (data: any) => void
    ): TemplateResult {
        return html`<activity-detail-edit-sheet
            .activityId=${data.id}
            .store=${data.store}
        ></activity-detail-edit-sheet>`;
    }
    protected firstUpdated(): void {
        let detail = this.store?.getActivityDetail(this.activityId);
        if (!Array.isArray(detail)) {
            this.store?.clearActivityDetail(this.activityId);
            if (detail && detail !== 1) {
                this.store?.addToArrayActivityDetail(
                    this.activityId,
                    `${detail}`
                );
            }
        }
        setTimeout(() => {
            this.inputRef?.value?.focus();
        }, 1);
    }
    add(amount: number) {
        this.store?.addToNumericActivityDetail(this.activityId, amount);
    }
    clear() {
        this.store?.clearActivityDetail(this.activityId);
    }
    addItemOrSubmit(e: any) {
        e.preventDefault();
        if (this.newItem !== '') {
            this.store?.addToArrayActivityDetail(this.activityId, this.newItem);
            this.newItem = '';
        } else {
            Sheet.close();
        }
    }
    render() {
        const detail = this.store?.getActivityDetail(this.activityId) || [];

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
                            const existingDetail =
                                this.store?.getActivityDetail(this.activityId);
                            if (
                                (Array.isArray(existingDetail) &&
                                    !existingDetail.length) ||
                                confirm('Continuing will clear existing detail')
                            ) {
                                this.store?.clearActivityDetail(
                                    this.activityId
                                );
                                Sheet.close();
                                QuickSet2.open(this.store, this.activityId);
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
                                : html`<input
                                          class="inline"
                                          type="text"
                                          .value=${Array.isArray(detail)
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
                        this.store?.addToArrayActivityDetail(
                            this.activityId,
                            e.detail.text
                        );
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
