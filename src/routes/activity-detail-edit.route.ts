import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { RouterLocation } from '@vaadin/router';
import { ActivityDetail } from '../interfaces/entry.interface.ts';
import { StatsDetailEntry } from '../interfaces/stats.interface.ts';
import { activities } from '../stores/activities.store';
import { DetailType, getDetailType } from '../utils/Helpers.ts';
import { AbstractSheetRoute } from './AbstractSheetRoute.ts';
import { store } from './entry-edit.route.ts';

@customElement('activity-edit-detail-route')
export class ActivityDetailEditRoute extends AbstractSheetRoute {
    @state()
    editorType: DetailType = 'array';
    activityId!: string;
    @state() activityDetail?: ActivityDetail;
    inputRef: Ref<HTMLElement> = createRef();
    @state()
    workingDetail?: ActivityDetail;
    @state()
    newItem: string = '';
    @state()
    currentlySelectedIndex?: number = undefined;
    isLoaded = false;

    async onAfterEnter(location: RouterLocation) {
        this.activityId = location.params.activityId as string;

        // Wait for store to be fully initialized (including draft decision if applicable)
        await store?.storeReady;
        this.activityDetail = store?.getActivityDetail(this.activityId);
        const detailType = getDetailType(this.activityDetail);
        this.editorType = detailType;
        // initialize workingDetail from loaded detail
        if (detailType === 'array') {
            this.workingDetail = [...(this.activityDetail as string[])];
        } else if (detailType === 'number') {
            this.workingDetail = this.activityDetail;
        } else if (detailType === 'string') {
            //handling odd strings
            this.workingDetail = [this.activityDetail as string];
        } else if (detailType === 'undefined') {
            this.editorType = 'array';
            this.workingDetail = [];
        }
        this.isLoaded = true;
        setTimeout(() => this.inputRef?.value?.focus(), 1);
    }
    async onBeforeLeave(_location: any, _commands: any, _router: any) {
        super.onBeforeLeave(_location, _commands, _router);
        this.handleActivityDetailUpdate(this.workingDetail);
    }

    private handleActivityDetailUpdate(updatedDetail?: ActivityDetail) {
        if (!this.activityId) return;
        if (
            updatedDetail === undefined ||
            updatedDetail === null ||
            (Array.isArray(updatedDetail) && updatedDetail.length === 0)
        ) {
            store?.clearActivityDetail(this.activityId);
        } else {
            store?.setActivityDetail(this.activityId, updatedDetail);
        }
    }

    add(amount: number) {
        const current =
            typeof this.workingDetail === 'number' ? this.workingDetail : 0;
        this.workingDetail = current + amount;
    }

    clear() {
        this.workingDetail = undefined;
        this.closePage();
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
            this.closePage();
        }
    }

    renderSheetContent() {
        if (!this.isLoaded) return html`${nothing}`;

        const detail = this.workingDetail || [];

        const lowerCaseDetails = (Array.isArray(detail) ? detail : []).map(
            (str) => str.toLowerCase()
        );
        const filter = (d: StatsDetailEntry) =>
            !lowerCaseDetails.includes(d.text.toLowerCase()) &&
            d.text.toLowerCase().includes(this.newItem.toLowerCase());

        return html`
            <header class="header-with-buttons">
                <activity-component
                    .detail=${this.editorType === 'number' ? detail : undefined}
                    .showName=${true}
                    .activity=${activities.getActivity(this.activityId)}
                ></activity-component>
                <div>
                    ${JSON.stringify(this.activityDetail) !==
                    JSON.stringify(this.workingDetail)
                        ? html`<button
                              class="inline"
                              @click=${() => {
                                  this.workingDetail = this.activityDetail;
                                  this.closePage();
                              }}
                          >
                              revert
                          </button>`
                        : nothing}
                    <select
                        class="inline"
                        .value=${this.editorType}
                        @change=${(e: any) => {
                            const newType = e.target.value as DetailType;
                            if (newType !== this.editorType) {
                                if (
                                    confirm(
                                        'Continuing will clear existing detail'
                                    )
                                ) {
                                    this.workingDetail = undefined;
                                    this.editorType = newType;
                                } else {
                                    e.target.value = this.editorType;
                                }
                            }
                        }}
                    >
                        <option value="number">number</option>
                        <option value="string">string</option>
                        <option value="array">array</option>
                    </select>

                    <button
                        class="inline secondary"
                        @click=${() => this.clear()}
                    >
                        clear
                    </button>
                </div>
            </header>
            <h2>Details</h2>
            ${this.editorType === 'number'
                ? html`<div class="number-editor">
                      <span class="positive-buttons">
                          <span
                              class="amount-button"
                              @click=${() => this.add(1)}
                          >
                              +1
                          </span>

                          <span
                              class="amount-button"
                              @click=${() => this.add(0.25)}
                          >
                              +¼
                          </span>
                          <span
                              class="amount-button"
                              @click=${() => this.add(10)}
                          >
                              +10
                          </span>
                      </span>
                      <span class="negative-buttons">
                          <span
                              class="amount-button"
                              @click=${() => this.add(-1)}
                          >
                              -1
                          </span>
                          <span
                              class="amount-button"
                              @click=${() => this.add(-0.25)}
                          >
                              -¼
                          </span>

                          <span
                              class="amount-button"
                              @click=${() => this.add(-10)}
                          >
                              -10
                          </span>
                      </span>
                  </div>`
                : nothing}
            ${this.editorType === 'array' || this.editorType === 'string'
                ? html`
                      <div class="activity-details">
                          ${(Array.isArray(detail) ? detail : []).map(
                              (item, index) => html`
                                  ${this.currentlySelectedIndex !== index
                                      ? html`<activity-detail
                                            @click=${() =>
                                                (this.currentlySelectedIndex =
                                                    index)}
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
                                                    if (newValue === '') return;
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
                          <form @submit=${this.addItemOrSubmit.bind(this)}>
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
                                        @click=${this.addItemOrSubmit.bind(
                                            this
                                        )}
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
                                  this.workingDetail = [
                                      ...items,
                                      e.detail.text,
                                  ];
                              }
                              this.newItem = '';
                          }}
                          .activityId=${this.activityId}
                          .filter=${filter}
                      ></activity-detail-stats>
                  `
                : nothing}
        `;
    }

    static styles = [
        ...AbstractSheetRoute.styles,
        css`
            .header-with-buttons {
                display: flex;
                align-items: center;
                justify-content: space-between;
                min-height: auto;
            }

            .activity-details {
                display: flex;
                flex-wrap: wrap;
            }
            form {
                display: flex;
                gap: 4px;
            }
            .amount-button {
                width: 24px;
                user-select: none;
                cursor: pointer;
                font-size: 16px;
                display: flex;
                justify-content: center;
                align-items: center;
            }

            .negative-buttons {
                grid-area: negative-buttons;
                justify-content: center;
                display: flex;
                width: 100%;
                gap: 32px;
            }
            .positive-buttons {
                grid-area: positive-buttons;
                justify-content: center;
                display: flex;
                width: 100%;
                gap: 32px;
            }
        `,
    ];
}
