import { css, html, LitElement, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import escapeRegExp from 'escape-string-regexp';
import { createStore } from 'zustand/vanilla';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import { Entry } from '../interfaces/entry.interface';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';

interface SearchState {
    searchTerm?: string;
    selectedActivityId?: string;
    selectedActivityDetail?: string;
    currentPage: number;
    lastPageIndex: number;
    firstEntryIndex: number;
    lastEntryIndex: number;
    numberOfResults: number;
    entryPage: Entry[];
    nextPage: () => void;
    prevPage: () => void;
    setSearchTerm: (s?: string) => void;
    setSelectedActivity: (id?: string, detail?: any) => void;
    getResultsText: () => string;
}

const filter = (state: SearchState): Entry[] => {
    if (!state.searchTerm && !state.selectedActivityId) return [];
    const filteredEntries = entries.getState().all.filter((entry) => {
        let regex = new RegExp(escapeRegExp(state?.searchTerm || ''), 'i');
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
        if (state?.selectedActivityId) {
            containsSearchQuery =
                (Object.keys(entry.activities) || []).includes(
                    state.selectedActivityId
                ) && containsSearchQuery;
            if (state.selectedActivityDetail) {
                containsSearchQuery =
                    Array.from(Object.values(entry.activities))
                        .filter((activity) => Array.isArray(activity))
                        .some((activityDetail) =>
                            (activityDetail as string[]).some(
                                (detail) =>
                                    detail.toLocaleLowerCase() ===
                                    (
                                        state.selectedActivityDetail as any
                                    ).toLocaleLowerCase()
                            )
                        ) && containsSearchQuery;
            }
        }
        return containsSearchQuery;
    });
    if (filteredEntries && filteredEntries.length) return filteredEntries;
    return [];
};
const generatePageData = (
    state: SearchState
): {
    currentPage: number;
    lastPageIndex: number;
    firstEntryIndex: number;
    lastEntryIndex: number;
    numberOfResults: number;
    entryPage: Entry[];
} => {
    state = state || {};
    const pageSize = 20;
    let results: any = {};
    let filteredEntries = filter(state);
    results.numberOfResults = filteredEntries.length;
    results.currentPage = state.currentPage || 0;
    results.lastPageIndex = Math.ceil(filteredEntries.length / pageSize) - 1;
    results.firstEntryIndex = results.currentPage * pageSize;
    results.lastEntryIndex = Math.min(
        (results.currentPage + 1) * pageSize,
        filteredEntries.length
    );
    results.entryPage = filteredEntries.slice(
        results.firstEntryIndex,
        results.lastEntryIndex
    );
    return results;
};
const store = createStore<SearchState>((set, get) => ({
    searchTerm: '',
    selectedActivityDetail: '',
    selectedActivityId: '',
    ...generatePageData(get()),
    setSearchTerm: (s?: string) =>
        set((state) => ({
            searchTerm: s,
            ...generatePageData({ ...state, searchTerm: s, currentPage: 0 }),
        })),
    setSelectedActivity: (id?: string, detail?: any) =>
        set((state) => ({
            selectedActivityId: id,
            selectedActivityDetail: detail,
            ...generatePageData({
                ...state,
                selectedActivityId: id,
                selectedActivityDetail: detail,
                currentPage: 0,
            }),
        })),
    getResultsText: () => {
        if (get().searchTerm || get().selectedActivityId)
            return !!get().numberOfResults
                ? `Results ${get().firstEntryIndex + 1}-${
                      get().lastEntryIndex
                  } of ${get().numberOfResults}`
                : 'No results';
        else return '';
    },
    nextPage: () =>
        set((state) => ({
            ...generatePageData({
                ...state,
                currentPage: state.currentPage + 1,
            }),
        })),
    prevPage: () =>
        set((state) => ({
            ...generatePageData({
                ...state,
                currentPage: state.currentPage - 1,
            }),
        })),
}));

@customElement('search-route')
export class SearchRoute extends LitElement {
    @state()
    state = store.getState();
    firstUpdated() {
        store.subscribe(() => {
            this.state = store.getState();
        });
    }
    addFilter() {
        if (!this.state.selectedActivityId) this.openActivitySelect();
        else this.openDetailPrompt();
    }
    openActivitySelect() {
        ActionSheetController.open({
            type: 'activity',
            onSubmit: (id: string) => {
                this.state.setSelectedActivity(id);
            },
        });
    }
    openDetailPrompt() {
        ActionSheetController.open({
            type: 'activityDetailSelect',
            onSubmit: (detail: any) =>
                this.state.setSelectedActivity(
                    this.state.selectedActivityId,
                    detail
                ),
            data: this.state.selectedActivityId,
        });
    }
    clearSelection() {
        if (this.state.selectedActivityDetail) {
            this.state.setSelectedActivity(this.state.selectedActivityId);
        } else if (this.state.selectedActivityId) {
            this.state.setSelectedActivity();
        } else {
            this.state.setSearchTerm();
        }
    }
    render() {
        return html` <section class="search-bar">
                <input
                    type="search"
                    class="inline"
                    focus="true"
                    .value=${this.state.searchTerm || ''}
                    @change=${(e: any) =>
                        this.state.setSearchTerm(e.target.value)}
                    placeholder="search..."
                />
                ${this.state.selectedActivityId
                    ? html`<span>
                          <activity-component
                              .showName=${true}
                              .activity=${activities.getActivity(
                                  this.state.selectedActivityId
                              )}
                              @click=${this.openActivitySelect}
                              .detail=${this.state.selectedActivityDetail
                                  ? [this.state.selectedActivityDetail]
                                  : undefined}
                              .enableDetailClick=${true}
                              .onDetailClick=${this.openDetailPrompt.bind(this)}
                          ></activity-component>
                      </span>`
                    : nothing}

                <span>
                    ${!this.state.selectedActivityId ||
                    !this.state.selectedActivityDetail
                        ? html`<feather-icon
                              @click=${() => this.addFilter()}
                              name="plus-circle"
                          ></feather-icon>`
                        : nothing}
                    ${this.state.searchTerm ||
                    this.state.selectedActivityId ||
                    this.state.selectedActivityDetail
                        ? html`<feather-icon
                              if.bind="searchBoxValue || selectedActivity || selectedDetail"
                              @click=${this.clearSelection}
                              name="x-circle"
                          ></feather-icon>`
                        : nothing}
                </span>
                <span>
                    ${this.state.currentPage !== 0
                        ? html`<feather-icon
                              role="link"
                              @click=${this.state.prevPage}
                              name="chevron-left"
                          ></feather-icon>`
                        : nothing}
                    ${this.state.currentPage !== this.state.lastPageIndex
                        ? html`<feather-icon
                              role="link"
                              @click=${this.state.nextPage}
                              name="chevron-right"
                          ></feather-icon>`
                        : nothing}
                </span>
                <div if.bind="showResultsText">
                    ${this.state.getResultsText()}
                </div>
            </section>
            <section>
                ${this.state.entryPage.map(
                    (entry) => html`
                        <entry-component
                            class="search-entries"
                            .entry=${entry}
                            .onDetailClick=${(data: any) =>
                                this.state.setSelectedActivity(
                                    data.id,
                                    data.detail
                                )}
                            .onActivityClick=${(id: any) =>
                                this.state.setSelectedActivity(id)}
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
