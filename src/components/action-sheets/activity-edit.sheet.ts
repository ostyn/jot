import { css, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { createStore } from 'zustand/vanilla';
import { base } from '../../baseStyles';
import { Activity } from '../../interfaces/activity.interface';
import { activities } from '../../stores/activities.store';
import { dispatchEvent, Events } from '../../utils/Helpers';
import { ActionSheetController } from './action-sheet-controller';

interface ActivityState {
    localActivity: Activity;
    getCategories: () => string[];
    setActivity: (activity: Activity) => void;
}
//TODO - This is bad but it's working for now. A store is overkill
const store = createStore<ActivityState>((set) => ({
    localActivity: {} as Activity,
    getCategories: () => activities.getCategories(),
    setActivity: (activity: Activity) =>
        set(() => ({
            localActivity: {
                category: activity.category || '',
                created: activity.created || '',
                emoji: activity.emoji || '',
                id: activity.id || (undefined as any),
                isArchived: activity.isArchived || false,
                name: activity.name || '',
            },
        })),
}));
@customElement('activity-edit-sheet')
export class ActivityEditSheet extends MobxLitElement {
    @state()
    state = store.getState();
    @property({ attribute: false })
    activity!: Activity;
    firstUpdated() {
        store.subscribe(() => {
            this.state = store.getState();
            this.render.bind(this);
        });

        store.getState().setActivity(this.activity);
    }
    @property({ attribute: false })
    categories?: string[];
    @property({ attribute: false })
    isCustom = false;

    deleteActivity() {
        if (confirm('Sure you want to delete?')) {
            activities.removeActivity(this.state.localActivity.id);
            dispatchEvent(this, Events.activityDeleted);
        }
    }
    submitActivity() {
        if (this.state.localActivity.id)
            activities.updateActivity(this.state.localActivity);
        else activities.addActivity(this.state.localActivity);
        dispatchEvent(this, Events.activitySubmitted);
    }
    selectCategory(value: string, existingActivity: Activity) {
        this.changeCategory(value, existingActivity);
        this.isCustom = false;
    }
    changeCategory(category: string, existingActivity: Activity) {
        store.getState().setActivity({
            ...existingActivity,
            category,
        });
    }
    selectCustom() {
        this.isCustom = true;
    }
    openInfo() {
        ActionSheetController.open({
            type: 'activity',
            data: this.state.localActivity,
        });
    }
    static getActionSheet(
        data: any,
        submit: (data: any) => void,
        dismiss: () => void
    ): TemplateResult {
        return html`${data.id
                ? html`<header>Edit Activity</header>`
                : html`<header>New Activity</header>`}
            <activity-edit-sheet
                @activityDeleted=${dismiss}
                @activitySubmitted=${submit}
                .activity=${data}
            ></activity-edit-sheet>`;
    }
    render() {
        let localActivity = store.getState().localActivity;
        return html` <form>
            <section class="activity-edit-buttons"></section>
            <section class="activity-inputs">
                <input
                    class="inline"
                    type="text"
                    .value=${localActivity?.name}
                    @change=${(e: any) =>
                        store.getState().setActivity({
                            ...localActivity,
                            name: e.target.value,
                        })}
                    placeholder="name"
                />
                <input
                    class="inline"
                    type="text"
                    .value=${localActivity?.emoji}
                    @change=${(e: any) =>
                        store.getState().setActivity({
                            ...localActivity,
                            emoji: e.target.value,
                        })}
                    placeholder="emoji"
                />
                <button
                    class="inline"
                    type="button"
                    @click=${this.submitActivity}
                >
                    save
                </button>
                ${localActivity?.id
                    ? html`<button
                          class="inline contrast"
                          type="button"
                          @click=${this.deleteActivity}
                      >
                          delete
                      </button>`
                    : nothing}
            </section>
            <section class="lastRow">
                <label class="inline archiveSwitch"
                    ><input
                        type="checkbox"
                        role="switch"
                        .checked=${localActivity?.isArchived}
                        @change=${(e: any) => {
                            console.log(e);
                            store.getState().setActivity({
                                ...localActivity,
                                isArchived: !localActivity.isArchived,
                            });
                        }}
                    />Archived</label
                >
                <details class="inline category-control" role="list">
                    <summary aria-haspopup="listbox">
                        ${localActivity.category || 'category'}
                    </summary>
                    <ul role="listbox" class="option-list">
                        ${this.state.getCategories()?.map(
                            (category) => html`
                                <li
                                    .class=${localActivity?.category == category
                                        ? 'selected-category'
                                        : ''}
                                >
                                    <label>
                                        <input
                                            type="radio"
                                            name="category"
                                            @click=${(e: any) =>
                                                this.selectCategory(
                                                    e.target.value,
                                                    localActivity
                                                )}
                                            .value=${category}
                                            .checked=${category ===
                                            localActivity.category}
                                            class="radio-button"
                                        />
                                        ${category}
                                    </label>
                                </li>
                            `
                        )}

                        <li>
                            <label>
                                <input
                                    class="radio-button"
                                    type="radio"
                                    name="category"
                                    @click=${this.selectCustom}
                                />
                                ${this.isCustom
                                    ? html`<input
                                          class="custom-category"
                                          type="text"
                                          @change=${(e: any) =>
                                              this.changeCategory(
                                                  e.target.value,
                                                  localActivity
                                              )}
                                          .value=${localActivity.category || ''}
                                          placeholder="category"
                                          focus="true"
                                      />`
                                    : html`<span>new category</span>`}
                            </label>
                        </li>
                    </ul>
                </details>
            </section>
        </form>`;
    }
    static styles = [
        base,
        css`
            .activity-edit-buttons {
                text-align: center;
            }
            .activity-inputs input {
                width: 33%;
            }
            .category-control {
                width: 33%;
            }
            activity-edit .category-control .option-list {
                position: relative;
            }
            .category-control * {
                z-index: 50;
            }
            input.custom-category {
                width: calc(100% - 20px);
            }
            .selected-category {
                background-color: var(--contrast);
                color: var(--contrast-inverse);
            }
            .radio-button {
                position: absolute;
                opacity: 0;
            }
            .category-control ul.option-list {
                position: unset;
            }
            .lastRow {
                display: flex;
                gap: 16px;
            }
            .archiveSwitch {
                padding: 12px;
            }
        `,
    ];
}
