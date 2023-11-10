import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { RouterLocation } from '@vaadin/router';
import { action, makeObservable, observable } from 'mobx';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import { ActivityDetail, Entry } from '../interfaces/entry.interface';
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
    @action.bound
    public setEntry(entry?: Entry) {
        this.setActivities(entry?.activities);
        this.setDate(entry?.date);
        this.setMood(entry?.mood);
        this.setNote(entry?.note);
    }
    @action.bound
    public setNote(note?: string) {
        this.note = note || '';
    }
    @action.bound
    public setActivities(activities?: { [key: string]: ActivityDetail }) {
        this.activities = activities || {};
    }
    @action.bound
    public setMood(mood?: string) {
        this.mood = mood || '0';
    }
    @action.bound
    public setDate(date?: string) {
        this.date = date || '';
    }
    @action.bound
    public setActivityDetail(activityId: string, detail: ActivityDetail) {
        if (Array.isArray(detail) && detail.length === 0)
            this.clearActivityDetail(activityId);
        else this.activities[activityId] = detail;
    }
    @action.bound
    public clearActivityDetail(activityId: string) {
        if (this.activities[activityId]) delete this.activities[activityId];
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
        let details = this.getActivityDetail(activityId);
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
    onAfterEnter(location: RouterLocation) {
        const originalEntry = entries.getEntry(location.params.id as string);
        this.store.setEntry({
            ...originalEntry,
            activities: { ...originalEntry?.activities },
        } as Entry);
    }
    longPress(id: string) {
        navigator.vibrate(100);
        this.editActivityDetail(id);
    }
    editActivityDetail(id: string) {
        ActionSheetController.open({
            type: 'activityDetailEdit',
            data: { id, store: this.store },
        });
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
                    <feather-icon
                        class="note-icon"
                        name="file-text"
                    ></feather-icon>
                </article>
                <div class="right-column">
                    <input
                        type="date"
                        class="inline date-control"
                        .value=${this.store.date || ''}
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
                    >
                        ${moods.getMood(this.store.mood)?.emoji}
                    </span>
                </div>
            </section>
            <activity-grid
                @activityClick=${(e: any) => this.longPress(e.detail.id)}
                on-activity-click.call="addActivity(activity.id)"
                on-activity-long-click.call="longPress(activity.id)"
                .selectedActivityInfo=${this.store.activities}
                .showFilterUnused=${true}
            ></activity-grid>
            <div class="sticky-buttons">
                <button
                    class="inline secondary"
                    click.trigger="deleteEntry()"
                    if.bind="entry.id"
                >
                    <feather-icon name="trash-2"></feather-icon>
                </button>
                <button class="inline" click.trigger="submitEntry()">
                    <feather-icon name="save"></feather-icon>
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
                padding: 0.5rem;
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
