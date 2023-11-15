import { css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import { Activity } from '../interfaces/activity.interface';
import { ActivityDetail } from '../interfaces/entry.interface';
import { activities } from '../stores/activities.store';
import { dispatchEvent as de, Events } from '../utils/Helpers';
import { ActionSheetController } from './action-sheets/action-sheet-controller';
import './activity.component';

@customElement('activity-grid')
export class ActivityGridComponent extends MobxLitElement {
    @property() activityDetailSet = () => {};
    @property() activityDetailClear = () => {};
    @state()
    private searchTerm = '';
    @property()
    filterArchived: boolean = true;
    @property()
    selectedActivityInfo?: { [key: string]: ActivityDetail };
    @property()
    showFilterUnused = false;
    @state()
    search: boolean = false;
    @state()
    filterUnused: boolean = false;
    @state()
    groupActivities: boolean = true;
    categoryToActivityList: Map<string, Activity[]> = new Map();
    getSortedHeaders() {
        return Array.from(this.categoryToActivityList.keys()).sort();
    }
    activitiesChanged() {
        this.categoryToActivityList = new Map();
        activities.all.forEach((activity: Activity) => {
            if (
                (this.filterArchived && activity.isArchived) ||
                (this.filterUnused &&
                    this.selectedActivityInfo &&
                    !this.selectedActivityInfo.hasOwnProperty(activity.id))
            ) {
                return;
            }
            if (
                !activity.name
                    .toLowerCase()
                    .includes(this.searchTerm.toLowerCase()) &&
                !(activity.category || '')
                    .toLowerCase()
                    .includes(this.searchTerm.toLowerCase()) &&
                !activity.emoji
                    .toLowerCase()
                    .includes(this.searchTerm.toLowerCase())
            )
                return;
            if (this.groupActivities) {
                const category = activity.category || 'uncategorized';
                const currentCategoryList: Activity[] =
                    this.categoryToActivityList.get(category) || [];
                currentCategoryList.push(activity);
                this.categoryToActivityList.set(category, currentCategoryList);
            } else {
                const category = 'activities';
                const currentCategoryList: Activity[] =
                    this.categoryToActivityList.get(category) || [];
                currentCategoryList.push(activity);
                this.categoryToActivityList.set(category, currentCategoryList);
            }
        });
        this.categoryToActivityList.forEach((val: Activity[]) => {
            val.sort(
                (a, b) =>
                    this.getActivityCount(b.id) - this.getActivityCount(a.id)
            );
        });
    }
    //TODO StatsService
    getActivityCount(activityId: string) {
        return activityId ? 5 : 4;
    }
    toggleShowArchived() {
        this.filterArchived = !this.filterArchived;
    }
    toggleFilterUnused() {
        this.filterUnused = !this.filterUnused;
    }
    toggleGroup() {
        this.groupActivities = !this.groupActivities;
    }
    render() {
        this.activitiesChanged();
        return html`
            <div class="grid-controls">
                ${this.search
                    ? html`<input
                          .value=${this.searchTerm}
                          @blur=${() => {
                              this.search = false;
                          }}
                          @input=${(e: any) => {
                              this.searchTerm = e.target.value;
                          }}
                          placeholder="search"
                          type="search"
                          class="inline"
                      />`
                    : html`<span
                          .title=${'search'}
                          class="grid-button"
                          @click=${() => {
                              this.search = !this.search;
                          }}
                      >
                          <feather-icon name="search"></feather-icon>
                          ${this.searchTerm ? '"' + this.searchTerm + '"' : ''}
                      </span>`}
                ${this.searchTerm || this.search
                    ? html`<span
                          .title=${'clear search'}
                          class="grid-button"
                          @click=${() => {
                              this.searchTerm = '';
                              this.search = false;
                          }}
                      >
                          <feather-icon name="x-circle"></feather-icon>
                      </span>`
                    : nothing}
                <span
                    .title=${this.filterArchived
                        ? 'filtering archived'
                        : 'showing all'}
                    class="grid-button"
                    @click=${this.toggleShowArchived}
                >
                    ${this.filterArchived
                        ? html`<feather-icon name="eye-off"></feather-icon>`
                        : html`<feather-icon name="eye"></feather-icon>`}
                </span>
                <span
                    .title=${this.groupActivities
                        ? 'grouping activities'
                        : 'no grouping'}
                    class="grid-button"
                    @click=${this.toggleGroup}
                >
                    ${this.groupActivities
                        ? html`<feather-icon name="server"></feather-icon>`
                        : html`<feather-icon
                              name="align-justify"
                          ></feather-icon>`}
                </span>
                ${this.showFilterUnused
                    ? html`<span
                          .title=${this.filterUnused
                              ? 'hiding unused'
                              : 'showing unused'}
                          class="grid-button"
                          @click=${this.toggleFilterUnused}
                      >
                          ${this.filterUnused
                              ? html`<feather-icon
                                    name="minimize-2"
                                ></feather-icon>`
                              : html`<feather-icon
                                    name="maximize-2"
                                ></feather-icon>`}
                      </span>`
                    : nothing}
                <span
                    title="add activity"
                    class="grid-button"
                    @click=${() => this.createNewActivity()}
                >
                    <feather-icon name="plus-circle"></feather-icon>
                </span>
            </div>
            ${this.getSortedHeaders().map(
                (header) => html`
                    <article>
                        <header class="group-header">${header}</header>
                        ${(this.categoryToActivityList.get(header) || []).map(
                            (activity) => {
                                return html`<activity-component
                                    .activity=${activity}
                                    .showName=${true}
                                    @click=${() => {
                                        de(
                                            this,
                                            Events.activityClick,
                                            activity
                                        );
                                    }}
                                    @longPress=${() => {
                                        de(this, Events.longPress, activity);
                                    }}
                                    .detail=${this.selectedActivityInfo?.[
                                        activity.id
                                    ]}
                                    class="clickable ${activity.isArchived
                                        ? 'disabled'
                                        : ''} ${this.selectedActivityInfo &&
                                    this.selectedActivityInfo.hasOwnProperty(
                                        activity.id
                                    )
                                        ? 'selected-item'
                                        : ''}"
                                ></activity-component>`;
                            }
                        )}
                        <span
                            title="add activity"
                            class="newButton"
                            @click=${() => this.createNewActivity(header)}
                        >
                            <feather-icon name="plus-circle"></feather-icon>
                        </span>
                    </article>
                `
            )}
        `;
    }
    public createNewActivity(category?: string) {
        ActionSheetController.open({
            type: 'activityEdit',
            data: { category },
        });
    }
    static styles = [
        base,
        css`
            .grid-controls {
                text-align: center;
                position: sticky;
                top: 0px;
                background-color: var(--card-background-color);
                z-index: 90;
                margin-left: 0.5rem;
                margin-right: 0.5rem;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .group-header {
                text-transform: uppercase;
                opacity: 0.6;
            }
            .disabled {
                background-image: radial-gradient(
                    var(--contrast),
                    rgba(0, 0, 0, 0),
                    rgba(0, 0, 0, 0)
                );
            }
            .clickable {
                cursor: pointer;
            }
            .grid-button {
                padding: 0.5rem;
                display: inline-flex;
                line-height: 0;
                cursor: pointer;
                align-items: center;
                gap: 8px;
            }
            activity-component.selected-item {
                border: var(--primary) 1px solid;
                border-radius: 12px;
            }
            .newButton {
                vertical-align: middle;
                vertical-align: -webkit-baseline-middle;
                cursor: pointer;
            }
        `,
    ];
}
