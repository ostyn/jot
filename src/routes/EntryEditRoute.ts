import { css, html, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { Router, RouterLocation } from '@vaadin/router';
import { base } from '../baseStyles';
import { ActionSheetController } from '../components/action-sheets/action-sheet-controller';
import { Entry } from '../interfaces/entry.interface';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';
import { until } from 'lit/directives/until.js';
import { EntryEditStore } from './entry-edit.route';


@customElement('entry-edit-route')
export class EntryEditRoute extends MobxLitElement {
    store = new EntryEditStore();
    originalEntry?: Entry;
    onAfterEnter(location: RouterLocation) {
        this.originalEntry = entries.getEntry(location.params.id as string);
        this.store.setEntry({
            ...this.originalEntry,
            activities: { ...this.originalEntry?.activities },
        } as Entry);
    }
    onBeforeLeave(_location: any, commands: any, _router: any) {
        if (this.store.pendingChanges && !confirm('Lose unsaved changes?')) {
            return commands.prevent();
        }
    }
    onClick(id: string) {
        navigator.vibrate(50);
        if (Array.isArray(this.store.getActivityDetail(id)))
            this.onLongClick(id);
        else this.store.addToNumericActivityDetail(id, 1);
    }
    onLongClick(id: string) {
        navigator.vibrate(100);
        this.editActivityDetail(id);
    }
    editActivityDetail(id: string) {
        ActionSheetController.open({
            type: 'activityDetailEdit',
            data: { id, store: this.store, defaultIsArray: true },
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
                    @click=${() => ActionSheetController.open({
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
                        @change=${(e: any) => this.store.setDate(e.target.value)}
                        .value=${this.store.date}
                        max.bind="date"
                        name=""
                    />
                    <span
                        class="mood-icon"
                        @click=${() => ActionSheetController.open({
            type: 'mood',
            data: this.store.mood || 0,
            onSubmit: (data) => this.store.setMood(data),
        })}
                    >${until(moods.getMood(this.store.mood), nothing`)}
                        ${}
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
                          @click=${() => {
                        entries.removeEntry(this.originalEntry?.id);
                        Router.go('/');
                    }}
                      >
                          <feather-icon name="trash-2"></feather-icon>
                      </button>`
                : nothing}

                <button
                    class="inline"
                    @click=${() => {
                this.store.unmarkPendingChanges();
                entries.upsertEntry({
                    ...this.originalEntry,
                    activities: { ...this.store.activities },
                    note: this.store.note,
                    mood: this.store.mood,
                    date: this.store.date,
                });
                Router.go('/');
            }}
                >
                    <feather-icon name="save"></feather-icon>
                </button>
            </div>
        `)}`;
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
