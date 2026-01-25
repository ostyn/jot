import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation } from '@vaadin/router';
import { format } from 'date-fns';
import { autorun, makeAutoObservable, toJS } from 'mobx';
import { base } from '../baseStyles';
import { Sheet } from '../components/action-sheets/action-sheet';
import { ActivityDetailEditSheet } from '../components/action-sheets/activity-detail-edit.sheet';
import { DraftPreviewSheet } from '../components/action-sheets/draft-preview-sheet';
import { MoodsSheet } from '../components/action-sheets/moods.sheet';
import { TextSheet } from '../components/action-sheets/text.sheet';
import '../components/mood.component';
import { QuickSet2 } from '../components/quick-set2.component';
import {
    ActivityDetail,
    EditTools,
    Entry,
} from '../interfaces/entry.interface';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';
import { DateHelpers } from '../utils/DateHelpers';
import { go } from './route-config';

export class EntryEditStore {
    constructor() {
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
}

@customElement('entry-edit-route')
export class EntryEditRoute extends MobxLitElement {
    store = new EntryEditStore();
    originalEntry!: Partial<Entry>;
    startEditTime = 0;
    async onAfterEnter(location: RouterLocation) {
        window.scrollTo({ top: 0 });
        this.startEditTime = new Date().getTime();
        try {
            this.originalEntry = (await entries.getEntry(
                location.params.id as string
            )) as Entry;
        } catch (e) {
            this.originalEntry = {
                activities: {},
                date: format(new Date(), 'yyyy-MM-dd'),
                mood: '0',
                note: '',
                editLog: [],
            };
        }

        const draft = localStorage.getItem(
            `entry-edit-draft-${this.originalEntry.date}`
        );
        if (draft) {
            Sheet.open({
                type: DraftPreviewSheet,
                data: JSON.parse(draft),
                onClose: (acceptDraft: boolean) => {
                    if (acceptDraft) {
                        this.store.setEntry(JSON.parse(draft), true);
                    } else {
                        localStorage.removeItem(
                            `entry-edit-draft-${this.originalEntry?.date}`
                        );
                        this.store.setEntry(this.originalEntry as Entry);
                    }
                },
            });
        } else {
            this.store.setEntry(this.originalEntry as Entry);
        }
    }

    onBeforeLeave(_location: any, commands: any, _router: any) {
        if (
            !Sheet.isShown &&
            this.store.pendingChanges &&
            !confirm('Lose unsaved changes?')
        ) {
            return commands.prevent();
        } else if (!Sheet.isShown) {
            localStorage.removeItem(`entry-edit-draft-${this.store.date}`);
            QuickSet2.close();
        }
    }
    onClick(e: CustomEvent) {
        const { id } = e.detail;
        if (navigator.vibrate) navigator?.vibrate(50);
        if (
            Array.isArray(this.store.getActivityDetail(id)) ||
            QuickSet2.latestValue?.activityId !== id
        )
            QuickSet2.open(this.store, id);
        else {
            this.store.addToNumericActivityDetail(id, 1);
            QuickSet2.open(this.store, id);
        }
    }
    onLongClick(id: string) {
        QuickSet2.close();
        if (navigator.vibrate) navigator?.vibrate(100);
        this.editActivityDetail(id);
    }
    editActivityDetail(id: string) {
        Sheet.open({
            type: ActivityDetailEditSheet,
            data: { id, store: this.store },
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
            <section class="entry-editor-buttons">
                <article
                    class="note-preview"
                    @click=${() =>
                        Sheet.open({
                            type: TextSheet,
                            data: this.store.note,
                            onClose: (data) => this.store.setNote(data),
                        })}
                >
                    <span>${this.store.note || 'Notes about your day?'}</span>
                    <jot-icon class="note-icon" name="FileText"></jot-icon>
                </article>
                <div class="right-column">
                    <input
                        type="date"
                        class="inline date-control"
                        @change=${(e: any) =>
                            this.store.setDate(e.target.value)}
                        .value=${this.store.date}
                        name=""
                    />
                    <span class="icons">
                        <mood-component
                            class="entry-header-emoji"
                            .mood=${moods.getMood(this.store.mood)}
                            @click=${() =>
                                Sheet.open({
                                    type: MoodsSheet,
                                    data: this.store.mood || 0,
                                    onClose: (data) => this.store.setMood(data),
                                })}
                        >
                        </mood-component>

                        <!-- TODO: removing feature for now <span
                            class="icon"
                            @click=\${() =>
                            Sheet.open({
                                type: MapSheet,
                                data: {
                                    ...this.store.location.coords,
                                    updatable: true,
                                },
                                onClose: (data) => {
                                    this.store.setLocation(data);
                                },
                            })}
                            ><jot-icon
                                .name=\${this.store.location.coords?.lat
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
        this.store.unmarkPendingChanges();
        entries.upsertEntry({
            ...this.originalEntry,
            activities: toJS(this.store.activities),
            note: this.store.note,
            mood: this.store.mood,
            date: this.store.date,
            // location: toJS(this.store.location.coords),
            editLog,
        });
        go('entries', {
            queryParams: DateHelpers.getDateStringParts(this.store.date),
        });
    }
}
