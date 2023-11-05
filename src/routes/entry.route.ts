import { css, html, LitElement } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { RouterLocation } from '@vaadin/router';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import { Entry } from '../interfaces/entry.interface';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';

@customElement('entry-route')
export class EntryRoute extends LitElement {
    @state()
    workingCopy?: Entry;
    onAfterEnter(location: RouterLocation) {
        this.workingCopy = {
            ...entries.getEntry(location.params.id as string),
        };
        window.scrollTo({ top: 0 });
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
                <div>
                    <input
                        type="date"
                        class="inline"
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
                if.bind="activityService.isLoaded"
                activities.bind="activities"
                on-activity-click.call="addActivity(activity.id)"
                on-activity-long-click.call="longPress(activity.id)"
                activity-detail-set.call="activityDetailSet(activity, newValue)"
                activity-detail-clear.call="activityDetailClear(activity)"
                .selectedActivityInfo=${this.workingCopy?.activities}
                show-filter-unused="true"
            ></activity-grid>
            <div class="sticky-buttons">
                <button
                    class="inline contrast"
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
                padding: 0.75rem;
                vertical-align: middle;
                white-space: pre-line;
                place-content: center;
                max-height: 6rem;
            }
            .note-icon {
                position: sticky;
                top: 0;
                right: 0;
                height: fit-content;
            }
            .mood-icon {
                font-size: 1.875rem;
                line-height: 2.25rem;
                cursor: pointer;
            }
            .entry-editor-buttons {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 8px;
            }
        `,
    ];
}
