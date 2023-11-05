import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { AfterEnterObserver, AfterLeaveObserver, Router } from '@vaadin/router';
import escapeRegExp from 'escape-string-regexp';
import { action, computed, makeObservable, observable, reaction } from 'mobx';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import { Entry } from '../interfaces/entry.interface';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';

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
        this.currentPage = page;
    }
    @action.bound
    public setSearchTerm(newTerm?: string) {
        this.currentPage = 0;
        this.searchTerm = newTerm || '';
    }
    @action.bound
    public setSelectedActivity(id?: string, detail?: any) {
        this.currentPage = 0;
        this.selectedActivityId = id || '';
        this.selectedActivityDetail = detail || '';
    }
    @computed
    get resultsText() {
        if (!this.searchTerm && !this.selectedActivityId) return;
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
        if (!this.searchTerm && !this.selectedActivityId) return [];
        const filteredEntries = entries.all.filter((entry) => {
            let regex = new RegExp(escapeRegExp(this?.searchTerm || ''), 'i');
            let containsSearchQuery =
                regex.test(entry.note) ||
                regex.test(entry.createdBy) ||
                regex.test(entry.lastUpdatedBy || '') ||
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
                    containsSearchQuery =
                        Array.from(Object.values(entry.activities))
                            .filter((activity) => Array.isArray(activity))
                            .some((activityDetail) =>
                                (activityDetail as string[]).some(
                                    (detail) =>
                                        detail.toLocaleLowerCase() ===
                                        (
                                            this.selectedActivityDetail as any
                                        ).toLocaleLowerCase()
                                )
                            ) && containsSearchQuery;
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
    implements AfterEnterObserver, AfterLeaveObserver
{
    store = new SearchStore();
    reactionDisposer: any;
    onAfterEnter() {
        window.addEventListener(
            'vaadin-router-location-changed',
            this.getParamsAndUpdate.bind(this)
        );
        this.getParamsAndUpdate();
        this.reactionDisposer = reaction(
            () => ({
                pageData: this.store.pageData,
                currentPage: this.store.currentPage,
            }),
            (data) => {
                window.scrollTo({ top: 0 });
                const queryParams = new URLSearchParams({
                    a: this.store.selectedActivityId,
                    detail: this.store.selectedActivityDetail,
                    p: data.currentPage,
                    q: this.store.searchTerm,
                } as any).toString();
                Router.go(`search?${queryParams}`);
            }
        );
    }
    private getParamsAndUpdate() {
        if (window.location.search) {
            const urlParams = new URLSearchParams(window.location.search);
            const searchTerm = urlParams.get('q');
            const activityId = urlParams.get('a');
            const activityDetail = urlParams.get('detail');
            const currentPage = urlParams.get('p');
            this.store.setSearchTerm(searchTerm || '');
            this.store.setSelectedActivity(activityId || '', activityDetail);
            this.store.setCurrentPage(
                currentPage ? Number.parseInt(currentPage) : 0
            );
        } else {
            this.store.setSearchTerm('');
            this.store.setSelectedActivity('', '');
            this.store.setCurrentPage(0);
        }
    }

    onAfterLeave() {
        this.reactionDisposer();
    }
    addFilter() {
        if (!this.store.selectedActivityId) this.openActivitySelect();
        else this.openDetailPrompt();
    }
    openActivitySelect() {
        ActionSheetController.open({
            type: 'activity',
            onSubmit: (id: string) => {
                this.store.setSelectedActivity(id);
            },
        });
    }
    openDetailPrompt() {
        ActionSheetController.open({
            type: 'activityDetailSelect',
            onSubmit: (detail: any) =>
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
    render() {
        return html` <section class="search-bar">
                <input
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
                              .enableDetailClick=${true}
                              .onDetailClick=${this.openDetailPrompt.bind(this)}
                          ></activity-component>
                      </span>`
                    : nothing}

                <span>
                    ${!this.store.selectedActivityId ||
                    !this.store.selectedActivityDetail
                        ? html`<feather-icon
                              @click=${() => this.addFilter()}
                              name="plus-circle"
                          ></feather-icon>`
                        : nothing}
                    ${this.store.searchTerm ||
                    this.store.selectedActivityId ||
                    this.store.selectedActivityDetail
                        ? html`<feather-icon
                              if.bind="searchBoxValue || selectedActivity || selectedDetail"
                              @click=${this.clearSelection}
                              name="x-circle"
                          ></feather-icon>`
                        : nothing}
                </span>
                <span>
                    ${this.store.currentPage !== 0
                        ? html`<feather-icon
                              role="link"
                              @click=${this.store.prevPage}
                              name="chevron-left"
                          ></feather-icon>`
                        : nothing}
                    ${this.store.currentPage !==
                    this.store.pageData.lastPageIndex
                        ? html`<feather-icon
                              role="link"
                              @click=${this.store.nextPage}
                              name="chevron-right"
                          ></feather-icon>`
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
                            .onDetailClick=${(data: any) =>
                                this.store.setSelectedActivity(
                                    data.id,
                                    data.detail
                                )}
                            .onActivityClick=${(id: any) =>
                                this.store.setSelectedActivity(id)}
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
                background-color: var(--background-color);
                display: flex;
                gap: 0.25rem;
                align-items: center;
                flex-wrap: wrap;
            }
            .search-bar input {
                width: 8rem;
            }
            .search-bar feather-icon {
                cursor: pointer;
            }
        `,
    ];
}
