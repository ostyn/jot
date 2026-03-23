import { css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { RouterLocation } from '@vaadin/router';
import { Location } from '../interfaces/entry.interface';
import { ActivityDetail } from '../interfaces/entry.interface.ts';
import { StatsDetailEntry } from '../interfaces/stats.interface.ts';
import { PhotonSearchResult, photonService } from '../services/photon.service';
import { activities } from '../stores/activities.store';
import { attachLocationToDetailValue } from '../utils/ActivityDetailLocationHelpers';
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
    @state()
    locationSearchResults: PhotonSearchResult[] = [];
    @state()
    showLocationSearch = false;
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
            // Normalize string to single-element array
            this.editorType = 'array';
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
            this.editorType === 'number' &&
            typeof this.workingDetail === 'number'
                ? this.workingDetail
                : 0;
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

    async searchLocations(query: string) {
        if (!query.trim()) {
            this.locationSearchResults = [];
            return;
        }
        const results = await photonService.search(query);
        this.locationSearchResults = results;
    }

    async attachLocationToItem(
        itemValue: string,
        location: PhotonSearchResult
    ) {
        const locationObj: Location = {
            id: crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(),
            name: location.name,
            lat: location.lat,
            lng: location.lng,
            city: location.city,
            country: location.country,
        };
        await attachLocationToDetailValue(itemValue, locationObj);
        this.locationSearchResults = [];
        this.showLocationSearch = false;
        this.newItem = '';
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
                    .detail=${this.editorType === 'number'
                        ? this.workingDetail
                        : undefined}
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
                        <option value="array">array</option>
                        <option value="locations">locations</option>
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
            ${this.editorType === 'array' || this.editorType === 'locations'
                ? html`
                      <div class="activity-details">
                          ${(Array.isArray(detail) ? detail : []).map(
                              (item, index) => html`
                                  ${this.currentlySelectedIndex !== index
                                      ? html`<div class="chip-container">
                                            <activity-detail
                                                @click=${() =>
                                                    (this.currentlySelectedIndex =
                                                        index)}
                                                class="chip"
                                                >${item}</activity-detail
                                            >
                                            <button
                                                class="chip-delete"
                                                @click=${(e: any) => {
                                                    e.stopPropagation();
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
                                                            ...this.workingDetail.slice(
                                                                index + 1
                                                            ),
                                                        ];
                                                    }
                                                }}
                                            >
                                                ×
                                            </button>
                                        </div>`
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
                                  @input=${(e: any) => {
                                      this.newItem = e.target.value;
                                      if (this.editorType === 'locations') {
                                          this.searchLocations(this.newItem);
                                      }
                                  }}
                                  placeholder=${this.editorType === 'locations'
                                      ? 'search location'
                                      : 'add item'}
                              />
                              ${this.editorType !== 'locations' && this.newItem
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
                          ${this.editorType === 'locations' &&
                          this.locationSearchResults.length > 0
                              ? html`<div class="location-search-results">
                                    ${this.locationSearchResults.map(
                                        (result) => html`
                                            <div class="location-result">
                                                <div class="location-name">
                                                    ${result.name}
                                                </div>
                                                ${result.city || result.country
                                                    ? html`<div
                                                          class="location-meta"
                                                      >
                                                          ${result.city}${result.city &&
                                                          result.country
                                                              ? ', '
                                                              : ''}${result.country}
                                                      </div>`
                                                    : nothing}
                                                <button
                                                    class="location-select"
                                                    @click=${async () => {
                                                        const items = (
                                                            Array.isArray(
                                                                this
                                                                    .workingDetail
                                                            )
                                                                ? this
                                                                      .workingDetail
                                                                : []
                                                        ) as string[];
                                                        const newItemName =
                                                            result.name;
                                                        if (
                                                            !items.includes(
                                                                newItemName
                                                            )
                                                        ) {
                                                            this.workingDetail =
                                                                [
                                                                    ...items,
                                                                    newItemName,
                                                                ];
                                                        }
                                                        await this.attachLocationToItem(
                                                            newItemName,
                                                            result
                                                        );
                                                    }}
                                                >
                                                    Add with location
                                                </button>
                                            </div>
                                        `
                                    )}
                                </div>`
                              : nothing}
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
                gap: 8px;
            }

            .chip-container {
                display: flex;
                align-items: center;
                gap: 0;
                position: relative;
            }

            .chip {
                cursor: pointer;
                padding-right: 24px;
            }

            .chip-delete {
                position: absolute;
                right: 0;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 18px;
                line-height: 1;
                color: inherit;
                opacity: 0.6;
                transition: opacity 0.2s;
            }

            .chip-delete:hover {
                opacity: 1;
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

            .location-search-results {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 8px;
                max-height: 300px;
                overflow-y: auto;
            }

            .location-result {
                display: flex;
                flex-direction: column;
                gap: 4px;
                padding: 8px;
                border: 1px solid var(--form-element-border-color);
                border-radius: 4px;
                background-color: var(--form-element-background-color);
            }

            .location-name {
                font-weight: 500;
                font-size: 14px;
            }

            .location-meta {
                font-size: 12px;
                opacity: 0.7;
            }

            .location-select {
                font-size: 12px;
                padding: 4px 8px;
                margin-top: 4px;
            }
        `,
    ];
}
