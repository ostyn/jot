import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { RouterLocation } from '@vaadin/router';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import { ActivityDetail, Entry } from '../interfaces/entry.interface';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';
import { Helpers } from '../utils/Helpers';

@customElement('entry-route')
export class EntryRoute extends LitElement {
    @state()
    workingCopy!: Entry;
    onAfterEnter(location: RouterLocation) {
        const originalEntry = entries.getEntry(location.params.id as string);
        this.workingCopy = {
            ...entries.getEntry(location.params.id as string),
            activities: { ...originalEntry.activities },
        };
        window.scrollTo({ top: 0 });
    }
    longPress(id: string) {
        navigator.vibrate(100);
        this.editActivityDetail(id, this.workingCopy?.activities[id]);
    }
    editActivityDetail(
        id: string,
        detail: ActivityDetail | undefined = undefined
    ) {
        ActionSheetController.open({
            type: 'activityDetailEdit',
            data: { id, detail },
            onSubmit: (detail: ActivityDetail) => {
                if (Array.isArray(detail)) {
                    if (detail.length > 0) {
                        this.workingCopy.activities[id] = detail;
                    } else if (detail.length === 0) {
                        delete this.workingCopy.activities[id];
                    }
                } else if (Helpers.isNumeric(detail)) {
                    this.workingCopy = {
                        ...this.workingCopy,
                        activities: {
                            ...this.workingCopy.activities,
                            [id]: detail,
                        },
                    };
                } else {
                    this.workingCopy = {
                        ...this.workingCopy,
                        activities: {
                            ...this.workingCopy.activities,
                        },
                    };
                    delete this.workingCopy.activities[id];
                }
            },
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
                            data: this.workingCopy?.note,
                            onSubmit: (data) =>
                                (this.workingCopy = {
                                    ...this.workingCopy,
                                    note: data,
                                }),
                        })}
                >
                    <span
                        >${this.workingCopy?.note || 'enter note here...'}</span
                    >
                    <feather-icon
                        class="note-icon"
                        name="file-text"
                    ></feather-icon>
                </article>
                <div class="right-column">
                    <input
                        type="date"
                        class="inline date-control"
                        .value=${this.workingCopy?.date || ''}
                        max.bind="date"
                        name=""
                    />
                    <span
                        class="mood-icon"
                        @click=${() =>
                            ActionSheetController.open({
                                type: 'mood',
                                data: this.workingCopy?.mood,
                                onSubmit: (data) =>
                                    (this.workingCopy = {
                                        ...this.workingCopy,
                                        mood: data,
                                    }),
                            })}
                    >
                        ${moods.getMood(this.workingCopy?.mood || '0')?.emoji}
                    </span>
                </div>
            </section>
            <activity-grid
                @activityClick=${(e) => this.longPress(e.detail.id)}
                on-activity-click.call="addActivity(activity.id)"
                on-activity-long-click.call="longPress(activity.id)"
                .selectedActivityInfo=${this.workingCopy?.activities}
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
