import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { Router, RouterLocation } from '@vaadin/router';
import { format } from 'date-fns';
import { action, makeObservable, observable, toJS } from 'mobx';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import {
    ActivityDetail,
    EditTools,
    Entry,
} from '../interfaces/entry.interface';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';

export class EntryEditStore {
    constructor() {
        makeObservable(this);
    }
    @observable
    note: string = '';
    @observable
    activities: { [key: string]: ActivityDetail } = {};
    @observable
    mood: string = '';
    @observable
    date: string = '';
    @observable
    pendingChanges = false;
    initialized = false;
    @action.bound
    public setEntry(entry?: Entry) {
        this.setActivities(entry?.activities);
        this.setDate(entry?.date);
        this.setMood(entry?.mood);
        this.setNote(entry?.note);
        this.initialized = true;
    }
    @action.bound
    public unmarkPendingChanges() {
        this.pendingChanges = false;
    }
    @action.bound
    public setNote(note?: string) {
        this.note = note || '';
        this.pendingChanges = true && this.initialized;
    }
    @action.bound
    public setActivities(activities?: { [key: string]: ActivityDetail }) {
        this.activities = activities || {};
        this.pendingChanges = true && this.initialized;
    }
    @action.bound
    public setMood(mood?: string) {
        this.mood = mood || '0';
        this.pendingChanges = true && this.initialized;
    }
    @action.bound
    public setDate(date?: string) {
        this.date = date || format(new Date(), 'yyyy-MM-dd');
        this.pendingChanges = true && this.initialized;
    }
    @action.bound
    public setActivityDetail(activityId: string, detail: ActivityDetail) {
        this.activities[activityId] = detail;
        this.pendingChanges = true && this.initialized;
    }
    @action.bound
    public clearActivityDetail(activityId: string) {
        if (this.activities[activityId]) delete this.activities[activityId];
        this.pendingChanges = true && this.initialized;
    }
    public getActivityDetail(activityId: string): ActivityDetail {
        return this.activities[activityId];
    }
    @action.bound
    public addToNumericActivityDetail(activityId: string, amount: number) {
        let detail = this.getActivityDetail(activityId);
        if (!Array.isArray(detail)) {
            detail = detail || 0;
            this.setActivityDetail(activityId, detail + amount);
        }
    }
    @action.bound
    public addToArrayActivityDetail(activityId: string, newDetail: string) {
        let details = this.getActivityDetail(activityId) || [];
        if (Array.isArray(details)) {
            this.setActivityDetail(activityId, [...details, newDetail]);
        }
    }
    @action.bound
    public updateArrayActivityDetail(
        activityId: string,
        index: number,
        updatedDetail: string
    ) {
        let details = this.getActivityDetail(activityId);
        if (Array.isArray(details)) {
            const newDetails = [...details];
            newDetails[index] = updatedDetail;
            this.setActivityDetail(activityId, newDetails);
        }
    }
    @action.bound
    public removeArrayActivityDetail(activityId: string, index: number) {
        let details = this.getActivityDetail(activityId);
        if (Array.isArray(details)) {
            const newDetails = [...details];
            newDetails.splice(index, 1);
            this.setActivityDetail(activityId, newDetails);
        }
    }
}

@customElement('entry-edit-route')
export class EntryEditRoute extends MobxLitElement {
    store = new EntryEditStore();
    originalEntry?: Partial<Entry>;
    async onAfterEnter(location: RouterLocation) {
        if (location.params.id) {
            this.originalEntry = await entries.getEntry(
                location.params.id as string
            );
        } else {
            this.originalEntry = {
                activities: {},
                date: '',
                mood: '0',
                note: '',
                createdBy: EditTools.WEB,
                lastUpdatedBy: EditTools.WEB,
            };
        }
        this.store.setEntry(this.originalEntry as Entry);
    }
    onBeforeLeave(_location: any, commands: any, _router: any) {
        if (this.store.pendingChanges && !confirm('Lose unsaved changes?')) {
            return commands.prevent();
        }
    }
    onClick(id: string) {
        if (navigator.vibrate) navigator?.vibrate(50);
        if (Array.isArray(this.store.getActivityDetail(id)))
            this.onLongClick(id);
        else this.store.addToNumericActivityDetail(id, 1);
    }
    onLongClick(id: string) {
        if (navigator.vibrate) navigator?.vibrate(100);
        this.editActivityDetail(id);
    }
    editActivityDetail(id: string) {
        ActionSheetController.open({
            type: 'activityDetailEdit',
            data: { id, store: this.store, defaultIsArray: true },
        });
    }
    deleteEntry(): void {
        if (confirm('Sure you want to delete?')) {
            entries.removeEntry(this.originalEntry?.id);
            Router.go('/');
        }
    }
    render() {
        return html`
            <section
                class="entry-editor-buttons"
                if.bind="activityService.isLoaded && !isLoadingEntry"
            >
                <article
                    class="note-preview"
                    @click=${() =>
                        ActionSheetController.open({
                            type: 'text',
                            data: this.store.note,
                            onSubmit: (data) => this.store.setNote(data),
                        })}
                >
                    <span>${this.store.note || 'enter note here...'}</span>
                    <jot-icon class="note-icon" name="FileText"></jot-icon>
                </article>
                <div class="right-column">
                    <input
                        type="date"
                        class="inline date-control"
                        @change=${(e: any) =>
                            this.store.setDate(e.target.value)}
                        .value=${this.store.date}
                        max.bind="date"
                        name=""
                    />
                    <span
                        class="mood-icon"
                        @click=${() =>
                            ActionSheetController.open({
                                type: 'mood',
                                data: this.store.mood || 0,
                                onSubmit: (data) => this.store.setMood(data),
                            })}
                        >${moods?.getMood(this.store.mood)?.emoji || ''}
                    </span>
                </div>
            </section>
            <activity-grid
                @activityClick=${(e: any) => this.onClick(e.detail.id)}
                @activityLongClick=${(e: any) => this.onLongClick(e.detail.id)}
                .selectedActivityInfo=${this.store.activities}
                .showFilterUnused=${true}
            ></activity-grid>
            <div class="sticky-buttons">
                ${this.originalEntry?.id
                    ? html`<button
                          class="inline secondary"
                          @click=${this.deleteEntry}
                      >
                          <jot-icon name="Trash2"></jot-icon>
                      </button>`
                    : nothing}

                <button
                    class="inline"
                    @click=${() => {
                        this.store.unmarkPendingChanges();
                        entries.upsertEntry({
                            ...this.originalEntry,
                            activities: toJS(this.store.activities),
                            note: this.store.note,
                            mood: this.store.mood,
                            date: this.store.date,
                            lastUpdatedBy: EditTools.WEB,
                            dateObject: new Date(this.store.date),
                            createdBy: EditTools.WEB,
                        });
                        Router.go('/');
                    }}
                >
                    <jot-icon name="Save"></jot-icon>
                </button>
            </div>
        `;
    }
    static styles = [
        base,
        css`
            .note-preview {
                display: flex;
                overflow: auto;
                position: relative;
                vertical-align: middle;
                white-space: pre-line;
                place-content: center;
                max-height: 6rem;
                margin: 0;
                width: 100%;
                padding: var(--form-element-spacing-vertical)
                    var(--form-element-spacing-horizontal);
                min-height: 100px;
            }
            .note-preview span {
                width: 100%;
            }
            .note-icon {
                position: sticky;
                top: 0;
                right: 0;
            }
            .right-column {
                display: flex;
                flex-flow: column;
                align-items: center;
                gap: 8px;
            }
            .date-control {
                width: 170px;
            }
            .mood-icon {
                font-size: 1.875rem;
                line-height: 2.25rem;
                cursor: pointer;
            }
            .entry-editor-buttons {
                display: flex;
                align-items: center;
                gap: 8px;
                margin: 0.5rem;
                min-height: 100px;
            }
        `,
    ];
}
