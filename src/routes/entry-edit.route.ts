import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation } from '@vaadin/router';
import { format } from 'date-fns';
import { autorun, makeAutoObservable, toJS } from 'mobx';
import { base } from '../baseStyles';
import { Sheet } from '../components/action-sheets/action-sheet';
import { DraftPreviewSheet } from '../components/action-sheets/draft-preview-sheet';
import { MoodsSheet } from '../components/action-sheets/moods.sheet';
import { TextSheet } from '../components/action-sheets/text.sheet';
import '../components/mood.component';
import {
    ActivityDetail,
    EditTools,
    Entry,
} from '../interfaces/entry.interface';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';
import { DateHelpers } from '../utils/DateHelpers';
import { betterGo, go } from './route-config';

export class EntryEditStore {
    id: string | undefined;
    storeReady: Promise<void>;
    private resolveStoreReady: (() => void) | undefined;
    constructor() {
        this.storeReady = new Promise((resolve) => {
            this.resolveStoreReady = resolve;
        });
        makeAutoObservable(this);
        autorun(() => {
            if (this.initialized && this.date) this.draftTime = Date.now();
            if (this.date && this.pendingChanges)
                localStorage.setItem(
                    `entry-edit-draft-${this.date}`,
                    JSON.stringify(toJS(this))
                );
        });
    }
    initialized = false;
    draftTime?: number;
    note: string = '';
    activities: { [key: string]: ActivityDetail } = {};
    mood: string = '';
    location: { coords?: { lat: number; lon: number } } = {};
    date: string = '';
    pendingChanges = false;
    public setEntry(
        entry?: Entry,
        pendingChanges: boolean = this.pendingChanges
    ) {
        this.setActivities(entry?.activities);
        this.setDate(entry?.date);
        this.setMood(entry?.mood);
        this.setNote(entry?.note);
        this.setLocation(entry?.location);
        this.initialized = true;
        this.id = entry?.id || 'new';
        this.pendingChanges = pendingChanges;
    }
    public unmarkPendingChanges() {
        this.pendingChanges = false;
    }
    public setNote(note?: string) {
        this.note = note || '';
        this.pendingChanges = this.initialized;
    }
    public setActivities(activities?: { [key: string]: ActivityDetail }) {
        this.activities = activities || {};
        this.pendingChanges = this.initialized;
    }
    public setMood(mood?: string) {
        this.mood = mood || '0';
        this.pendingChanges = this.initialized;
    }
    public setLocation(location?: { lat: number; lon: number }) {
        this.location.coords = location;
        this.pendingChanges = this.initialized;
    }
    public setDate(date?: string) {
        this.date = date || format(new Date(), 'yyyy-MM-dd');
        this.pendingChanges = this.initialized;
    }
    public setActivityDetail(activityId: string, detail: ActivityDetail) {
        this.activities[activityId] = detail;
        this.pendingChanges = this.initialized;
    }
    public clearActivityDetail(activityId: string) {
        if (this.activities[activityId]) delete this.activities[activityId];
        this.pendingChanges = this.initialized;
    }
    public getActivityDetail(activityId: string): ActivityDetail {
        return this.activities[activityId];
    }
    public addToNumericActivityDetail(activityId: string, amount: number) {
        let detail = this.getActivityDetail(activityId);
        if (!Array.isArray(detail)) {
            detail = detail || 0;
            this.setActivityDetail(activityId, detail + amount);
        }
    }
    public addToArrayActivityDetail(activityId: string, newDetail: string) {
        let details = this.getActivityDetail(activityId) || [];
        if (Array.isArray(details)) {
            this.setActivityDetail(activityId, [...details, newDetail.trim()]);
        }
    }
    public updateArrayActivityDetail(
        activityId: string,
        index: number,
        updatedDetail: string
    ) {
        let details = this.getActivityDetail(activityId);
        if (Array.isArray(details)) {
            const newDetails = [...details];
            newDetails[index] = updatedDetail.trim();
            this.setActivityDetail(activityId, newDetails);
        }
    }
    public removeArrayActivityDetail(activityId: string, index: number) {
        let details = this.getActivityDetail(activityId);
        if (Array.isArray(details)) {
            const newDetails = [...details];
            newDetails.splice(index, 1);
            this.setActivityDetail(activityId, newDetails);
        }
    }
    public reset() {
        this.id = undefined;
        this.initialized = false;
        this.draftTime = undefined;
        this.note = '';
        this.activities = {};
        this.mood = '0';
        this.location = {};
        this.date = '';
        this.pendingChanges = false;
        // Reset the storeReady promise for next use
        this.storeReady = new Promise((resolve) => {
            this.resolveStoreReady = resolve;
        });
    }
    public markReady() {
        this.resolveStoreReady?.();
    }
}
export let store: EntryEditStore = new EntryEditStore();

@customElement('entry-edit-route')
export class EntryEditRoute extends MobxLitElement {
    originalEntry!: Partial<Entry>;
    startEditTime = 0;
    async onAfterEnter(location: RouterLocation) {
        //If the store was already used for another entry, reset it ASAP
        if (store?.id != location.params.id) store.reset();
        window.scrollTo({ top: 0 });
        this.startEditTime = new Date().getTime();
        try {
            this.originalEntry = (await entries.getEntry(
                location.params.id as string
            )) as Entry;
        } catch {}
        if (!this.originalEntry) {
            this.originalEntry = {
                activities: {},
                date: format(new Date(), 'yyyy-MM-dd'),
                mood: '0',
                note: '',
                editLog: [],
                id: 'new',
            };
        }
        if (
            store?.id != location.params.id &&
            'undefined' != location.params.id
        ) {
            const draft = localStorage.getItem(
                `entry-edit-draft-${this.originalEntry.date}`
            );
            if (draft) {
                Sheet.open({
                    type: DraftPreviewSheet,
                    data: JSON.parse(draft),
                    onClose: (acceptDraft: boolean) => {
                        if (acceptDraft) {
                            store.setEntry(JSON.parse(draft), true);
                        } else {
                            localStorage.removeItem(
                                `entry-edit-draft-${this.originalEntry?.date}`
                            );
                            store.setEntry(this.originalEntry as Entry);
                        }
                        store.markReady();
                    },
                    ignoreHistory: true,
                });
            } else {
                store.setEntry(this.originalEntry as Entry);
                store.markReady();
            }
        } else {
            store.setEntry(this.originalEntry as Entry);
            store.markReady();
        }
    }
    onBeforeLeave(location: any, commands: any, _router: any) {
        if (
            location.routes[0].component !== 'entry-edit-route' &&
            !Sheet.isShown &&
            store.pendingChanges &&
            !confirm('Lose unsaved changes?')
        ) {
            return commands.prevent();
        } else if (!Sheet.isShown) {
            localStorage.removeItem(`entry-edit-draft-${store.date}`);
        }
    }
    onClick(e: CustomEvent) {
        const { id } = e.detail;
        if (navigator.vibrate) navigator?.vibrate(50);
        if (Array.isArray(store.getActivityDetail(id)))
            this.editActivityDetail(id);
        else {
            store.addToNumericActivityDetail(id, 1);
        }
    }
    onLongClick(id: string) {
        if (navigator.vibrate) navigator?.vibrate(100);
        this.editActivityDetail(id);
    }
    editActivityDetail(id: string) {
        betterGo('activity-detail-edit', {
            pathParams: { id: this.originalEntry.id as string, activityId: id },
        });
    }
    deleteEntry(): void {
        if (confirm('Sure you want to delete?')) {
            entries.removeEntry(this.originalEntry?.id);
            go('entries');
        }
    }
    render() {
        return html`
            <slot></slot>
            <section class="entry-editor-buttons">
                <article
                    class="note-preview"
                    @click=${() =>
                        Sheet.open({
                            type: TextSheet,
                            data: store.note,
                            onClose: (data) => store.setNote(data),
                        })}
                >
                    <span>${store.note || 'Notes about your day?'}</span>
                    <jot-icon class="note-icon" name="FileText"></jot-icon>
                </article>
                <div class="right-column">
                    <input
                        type="date"
                        class="inline date-control"
                        @change=${(e: any) => store.setDate(e.target.value)}
                        .value=${store.date}
                        name=""
                    />
                    <span class="icons">
                        <mood-component
                            class="entry-header-emoji"
                            .mood=${moods.getMood(store.mood)}
                            @click=${() =>
                                Sheet.open({
                                    type: MoodsSheet,
                                    data: store.mood || 0,
                                    onClose: (data) => store.setMood(data),
                                })}
                        >
                        </mood-component>

                        <!-- TODO: removing feature for now <span
                            class="icon"
                            @click=\${() =>
                            Sheet.open({
                                type: MapSheet,
                                data: {
                                    ...store.location.coords,
                                    updatable: true,
                                },
                                onClose: (data) => {
                                    store.setLocation(data);
                                },
                            })}
                            ><jot-icon
                                .name=\${store.location.coords?.lat
                            ? 'MapPin'
                            : 'MapPinOff'}
                            ></jot-icon>
                        </span> -->
                    </span>
                </div>
            </section>
            <activity-grid
                @activityClick=${this.onClick}
                @activityLongClick=${(e: any) => this.onLongClick(e.detail.id)}
                .selectedActivityInfo=${store.activities}
                .showFilterUnused=${true}
            ></activity-grid>
            <div class="sticky-buttons">
                ${this.originalEntry?.id && this.originalEntry.id !== 'new'
                    ? html`<button
                          class="inline secondary"
                          @click=${this.deleteEntry}
                      >
                          <jot-icon name="Trash2"></jot-icon>
                      </button>`
                    : nothing}

                <button class="inline" @click=${this.saveEntry}>
                    <jot-icon name="Save"></jot-icon>
                </button>
            </div>
        `;
    }
    static styles = [
        base,
        css`
            :host {
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                margin-top: 1rem;
            }
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
                padding: var(--pico-form-element-spacing-vertical)
                    var(--pico-form-element-spacing-horizontal);
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
            .icons {
                width: 100%;
                display: flex;
                justify-content: space-around;
            }
            .icon {
                font-size: 1.875rem;
                line-height: 2.25rem;
                cursor: pointer;
            }
            .entry-editor-buttons {
                display: flex;
                align-items: stretch;
                gap: 8px;
                min-height: 100px;
            }
        `,
    ];

    private saveEntry() {
        const now = new Date();
        const timeSpentEditing = now.getTime() - this.startEditTime;
        const editLog = [
            ...(this.originalEntry?.editLog || []),
            { date: now, duration: timeSpentEditing, tool: EditTools.JOT },
        ];
        store.unmarkPendingChanges();
        entries.upsertEntry({
            ...this.originalEntry,
            activities: toJS(store.activities),
            note: store.note,
            mood: store.mood,
            date: store.date,
            // location: toJS(store.location.coords),
            editLog,
        });
        go('entries', {
            queryParams: DateHelpers.getDateStringParts(store.date),
        });
    }
}
