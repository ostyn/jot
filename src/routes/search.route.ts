import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { WebComponentInterface } from '@vaadin/router';
import { format } from 'date-fns';
import escapeRegExp from 'escape-string-regexp';
import { action, computed, makeObservable, observable, reaction } from 'mobx';
import { base } from '../baseStyles';
import { Sheet } from '../components/action-sheets/action-sheet';
import { ActivityDetailSelectSheet } from '../components/action-sheets/activity-detail-select.sheet';
import { ActivityInfoSheet } from '../components/action-sheets/activity-info.sheet';
import { ActivitySheet } from '../components/action-sheets/activity.sheet';
import { DateSheet } from '../components/action-sheets/date.sheet';
import { Entry } from '../interfaces/entry.interface';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { go } from './route-config';

class SearchStore {
    constructor() {
        makeObservable(this);
    }
    @observable
    currentPage: number = 0;
    @observable
    searchTerm?: string = '';
    @observable
    selectedActivityId?: string = '';
    @observable
    selectedActivityDetail?: string = '';
    @observable
    startDate: string = '';
    @observable
    endDate: string = '';
    @action.bound
    public nextPage() {
        this.currentPage++;
    }
    @action.bound
    public prevPage() {
        this.currentPage--;
    }
    @action.bound
    public setCurrentPage(page: number) {
        this.currentPage = Math.min(page, this.pageData.lastPageIndex);
    }
    @action.bound
    public setSearchTerm(newTerm?: string) {
        this.currentPage = 0;
        this.searchTerm = newTerm || '';
    }
    @action.bound
    public setStartDate(newTerm: string) {
        this.startDate = newTerm;
    }
    @action.bound
    public setEndDate(newTerm: string) {
        this.endDate = newTerm;
    }
    @action.bound
    public setSelectedActivity(id?: string, detail?: any) {
        this.currentPage = 0;
        this.selectedActivityId = id || '';
        this.selectedActivityDetail = detail || '';
    }
    @computed
    get resultsText() {
        if (
            !this.searchTerm &&
            !this.selectedActivityId &&
            !this.startDate &&
            !this.endDate
        )
            return;
        return this.pageData.numberOfResults
            ? `Results ${this.pageData.firstEntryIndex + 1}-${
                  this.pageData.lastEntryIndex
              } of ${this.pageData.numberOfResults}`
            : 'No results';
    }
    @computed
    public get pageData(): {
        lastPageIndex: number;
        firstEntryIndex: number;
        lastEntryIndex: number;
        numberOfResults: number;
        entryPage: Entry[];
    } {
        const pageSize = 20;
        let results: any = {};
        let filteredEntries = this.filteredEntries;
        results.numberOfResults = filteredEntries.length;
        results.lastPageIndex = Math.max(
            Math.ceil(filteredEntries.length / pageSize) - 1,
            0
        );
        results.firstEntryIndex = this.currentPage * pageSize;
        results.lastEntryIndex = Math.min(
            (this.currentPage + 1) * pageSize,
            filteredEntries.length
        );
        results.entryPage = filteredEntries.slice(
            results.firstEntryIndex,
            results.lastEntryIndex
        );
        return results;
    }
    @computed
    private get filteredEntries(): Entry[] {
        if (
            !this.searchTerm &&
            !this.selectedActivityId &&
            this.startDate === '' &&
            this.endDate === ''
        )
            return [];
        let filteredEntries;
        const startDate = this.startDate !== '' ? this.startDate : '0000-01-01';
        const endDate = this.endDate !== '' ? this.endDate : '9999-12-31';
        filteredEntries = entries.all.filter(
            (entry) => entry.date >= startDate && entry.date <= endDate
        );

        filteredEntries = filteredEntries.filter((entry) => {
            let regex = new RegExp(escapeRegExp(this?.searchTerm || ''), 'i');
            let containsSearchQuery =
                regex.test(entry.note) ||
                regex.test(entry.id || '') ||
                regex.test(entry.editLog[0]?.tool || '') ||
                Array.from(Object.values(entry.activities))
                    .filter((activity) => Array.isArray(activity))
                    .some((activityDetail) =>
                        (activityDetail as string[]).some((detail) =>
                            regex.test(detail)
                        )
                    ) ||
                (Object.keys(entry.activities) || []).some((activityId) =>
                    regex.test(activities.getActivity(activityId)?.name)
                ) ||
                regex.test(entry.date);
            if (this?.selectedActivityId) {
                containsSearchQuery =
                    (Object.keys(entry.activities) || []).includes(
                        this.selectedActivityId
                    ) && containsSearchQuery;
                if (this.selectedActivityDetail) {
                    const activityDetails =
                        entry.activities[this.selectedActivityId];
                    if (Array.isArray(activityDetails)) {
                        containsSearchQuery =
                            activityDetails.includes(
                                this.selectedActivityDetail
                            ) && containsSearchQuery;
                    } else {
                        containsSearchQuery = false;
                    }
                }
            }
            return containsSearchQuery;
        });
        return filteredEntries;
    }
}

@customElement('search-route')
export class SearchRoute
    extends MobxLitElement
    implements WebComponentInterface
{
    inputRef: Ref<HTMLElement> = createRef();
    store = new SearchStore();
    reactionDisposer: any;
    onAfterEnter() {
        window.addEventListener('jot-navigate', this.getParamsAndUpdate);
        this.getParamsAndUpdate();
        // Updating URL based on state updates
        this.reactionDisposer = reaction(
            () => ({
                currentPage: this.store.currentPage,
                selectedActivityId: this.store.selectedActivityId,
                selectedActivityDetail: this.store.selectedActivityDetail,
                searchTerm: this.store.searchTerm,
                startDate: this.store.startDate,
                endDate: this.store.endDate,
            }),
            (data) => {
                // Avoids redirecting from `/search` to /search?a=&detail=&p=&q=
                if (
                    data.selectedActivityId ||
                    data.searchTerm ||
                    data.startDate ||
                    data.endDate
                ) {
                    window.scrollTo({ top: 0 });

                    go('search', {
                        queryParams: {
                            a: data.selectedActivityId,
                            detail: data.selectedActivityDetail,
                            p: data.currentPage,
                            q: data.searchTerm,
                            startDate: data.startDate,
                            endDate: data.endDate,
                        },
                    });
                } else {
                    go(`search`);
                }
            }
        );
    }
    protected firstUpdated(): void {
        this.inputRef?.value?.focus();
    }
    // Updating state based on initial URL and back/forward browser buttons
    private getParamsAndUpdate = () => {
        if (window.location.pathname.includes('search')) {
            const urlParams = new URLSearchParams(window.location.search);
            const searchTerm = urlParams.get('q') || '';
            const activityId = urlParams.get('a') || '';
            const startDate = urlParams.get('startDate') || '';
            const endDate = urlParams.get('endDate') || '';
            const activityDetail = urlParams.get('detail');
            const currentPage = Number.parseInt(urlParams.get('p') || '0');

            if (searchTerm !== this.store.searchTerm)
                this.store.setSearchTerm(searchTerm);
            if (
                activityId !== this.store.selectedActivityId ||
                activityDetail !== this.store.selectedActivityDetail
            )
                this.store.setSelectedActivity(activityId, activityDetail);
            if (startDate !== this.store.startDate)
                this.store.setStartDate(startDate);
            if (endDate !== this.store.endDate) this.store.setEndDate(endDate);
            this.store.setCurrentPage(currentPage);
        }
    };
    onAfterLeave() {
        this.reactionDisposer();
        window.removeEventListener('jot-navigate', this.getParamsAndUpdate);
    }
    addFilter() {
        if (!this.store.selectedActivityId) this.openActivitySelect();
        else this.openDetailPrompt();
    }
    openActivitySelect() {
        Sheet.open({
            type: ActivitySheet,
            onClose: (id: string) => {
                this.store.setSelectedActivity(id);
            },
        });
    }
    openDetailPrompt() {
        Sheet.open({
            type: ActivityDetailSelectSheet,
            onClose: (detail: any) =>
                this.store.setSelectedActivity(
                    this.store.selectedActivityId,
                    detail
                ),
            data: this.store.selectedActivityId,
        });
    }
    clearSelection() {
        if (this.store.selectedActivityDetail) {
            this.store.setSelectedActivity(this.store.selectedActivityId);
        } else if (this.store.selectedActivityId) {
            this.store.setSelectedActivity();
        } else {
            this.store.setSearchTerm();
        }
    }
    openDateRangeSelector() {
        Sheet.open({
            type: DateSheet,
            data: {
                date: this.store.startDate || new Date(),
                selectionMode: 'range',
                selectedDates:
                    this.store.startDate && this.store.endDate
                        ? [this.store.startDate, this.store.endDate]
                        : [],
            },
            onClose: (data: any) => {
                if (data && data.startDate) {
                    this.store.setStartDate(
                        format(data.startDate, 'yyyy-MM-dd')
                    );
                }
                if (data && data.endDate) {
                    this.store.setEndDate(format(data.endDate, 'yyyy-MM-dd'));
                }
            },
        });
    }
    render() {
        return html` <section class="search-bar">
                <input
                    ${ref(this.inputRef)}
                    type="search"
                    class="inline"
                    focus="true"
                    .value=${this.store.searchTerm || ''}
                    @change=${(e: any) =>
                        this.store.setSearchTerm(e.target.value)}
                    placeholder="search..."
                />
                ${this.store.selectedActivityId
                    ? html`<span>
                          <activity-component
                              .showName=${true}
                              .activity=${activities.getActivity(
                                  this.store.selectedActivityId
                              )}
                              @click=${this.openActivitySelect}
                              .detail=${this.store.selectedActivityDetail
                                  ? [this.store.selectedActivityDetail]
                                  : undefined}
                              @activityDetailClick=${(data: any) => {
                                  this.openDetailPrompt();
                                  data.detail.event.stopPropagation();
                              }}
                          ></activity-component>
                      </span>`
                    : nothing}

                <span>
                    ${!this.store.selectedActivityId ||
                    !this.store.selectedActivityDetail
                        ? html`<jot-icon
                              @click=${() => this.addFilter()}
                              name="PlusCircle"
                          ></jot-icon>`
                        : nothing}
                    ${this.store.searchTerm ||
                    this.store.selectedActivityId ||
                    this.store.selectedActivityDetail
                        ? html`<jot-icon
                              @click=${this.clearSelection}
                              name="XCircle"
                          ></jot-icon>`
                        : nothing}
                </span>

                <span>
                    ${this.store.startDate || this.store.endDate
                        ? html`<jot-icon
                              @click=${() => this.openDateRangeSelector()}
                              name="CalendarCheck"
                          ></jot-icon>`
                        : html`<jot-icon
                              @click=${() => this.openDateRangeSelector()}
                              name="CalendarPlus"
                          ></jot-icon>`}
                </span>
                <span class="date-info">
                    ${this.store.startDate || this.store.endDate
                        ? html`
                              <jot-icon
                                  @click=${() => {
                                      this.store.setStartDate('');
                                      this.store.setEndDate('');
                                  }}
                                  name="XCircle"
                              ></jot-icon>
                          `
                        : nothing}
                </span>
                <span>
                    ${this.store.currentPage !== 0
                        ? html`<jot-icon
                              role="link"
                              @click=${this.store.prevPage}
                              name="ChevronLeft"
                          ></jot-icon>`
                        : nothing}
                    ${this.store.currentPage !==
                    this.store.pageData.lastPageIndex
                        ? html`<jot-icon
                              role="link"
                              @click=${this.store.nextPage}
                              name="ChevronRight"
                          ></jot-icon>`
                        : nothing}
                </span>
                <div>${this.store.resultsText}</div>
            </section>
            <section>
                ${this.store.pageData.entryPage.map(
                    (entry) => html`
                        <entry-component
                            class="search-entries"
                            .entry=${entry}
                            @activityDetailClick=${(data: any) => {
                                this.store.setSelectedActivity(
                                    data.detail.id,
                                    data.detail.detail
                                );
                                data.detail.event.stopPropagation();
                            }}
                            @activityClick=${(data: any) => {
                                this.store.setSelectedActivity(data.detail.id);
                            }}
                            @activityLongClick=${(e: any) => {
                                Sheet.open({
                                    type: ActivityInfoSheet,
                                    data: {
                                        id: e.detail.id,
                                        date: new Date(
                                            entry.date + 'T00:00:00'
                                        ),
                                    },
                                });
                            }}
                        ></entry-component>
                    `
                )}
            </section>`;
    }
    static styles = [
        base,
        css`
            .search-bar {
                width: 100%;
                position: sticky;
                top: -0.1px;
                left: 0;
                z-index: 50;
                padding: 0.5rem;
                background-color: var(--pico-background-color);
                display: flex;
                gap: 0.25rem;
                align-items: center;
                flex-wrap: wrap;
            }
            .search-bar input {
                width: 8rem;
            }
            .search-bar jot-icon {
                cursor: pointer;
            }
        `,
    ];
}
