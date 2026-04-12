import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import '../components/calendar-wrapper.component';
import '../components/edit-log-dates.component';
import { notes } from '../stores/notes.store';
import { betterGo } from './route-config';

@customElement('notes-route')
export class NotesRoute extends MobxLitElement {
    private get canShare() {
        return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    }

    private handleNoteClick(note: any) {
        betterGo('note-edit', { pathParams: { id: note.id } });
    }

    private handleNewNoteClick() {
        betterGo('note-edit');
    }

    private async handleShareClick(event: Event, note: { content: string }) {
        event.stopPropagation();
        if (!this.canShare || !note.content.trim()) return;

        try {
            await navigator.share({
                title: note.content.split('\n')[0] || 'Note',
                text: note.content,
            });
        } catch (error) {
            if ((error as DOMException).name !== 'AbortError') throw error;
        }
    }

    private async handleDeleteClick(
        event: Event,
        note: { id?: string; content: string }
    ) {
        event.stopPropagation();
        if (!note.id) return;

        const title = note.content.split('\n')[0] || 'this note';
        if (!window.confirm(`Delete "${title}"?`)) return;

        await notes.removeNote(note.id);
    }

    render() {
        return html` <slot></slot>
            <article class="notesHeader">
                <header>Notes</header>
            </article>
            <hr />
            ${Object.entries(notes.getNotesObjectByPath()).map(
                ([folderName, notesInFolder], index) =>
                    html` <details name="example" ?open=${index === 0}>
                            <summary class="folderLabel">
                                ${folderName || 'Default'}
                            </summary>
                            <div class="notes-folder">
                                ${notesInFolder.map(
                                    (note) =>
                                        html` <article
                                            @click=${() =>
                                                this.handleNoteClick(note)}
                                        >
                                            <header>
                                                ${note.content.split('\n')[0]}
                                            </header>

                                            <section class="note-content">
                                                ${note.content
                                                    .split('\n')
                                                    .slice(1)
                                                    .join('\n')}
                                            </section>
                                            <footer>
                                                <edit-log-dates
                                                    class="edit-dates"
                                                    .editLog=${note.editLog}
                                                ></edit-log-dates>
                                                <div class="note-actions">
                                                    ${this.canShare
                                                        ? html`<button
                                                              type="button"
                                                              class="secondary share-button"
                                                              @click=${(event: Event) =>
                                                                  this.handleShareClick(
                                                                      event,
                                                                      note
                                                                  )}
                                                          >
                                                              <jot-icon name="Share"></jot-icon>
                                                              Share
                                                          </button>`
                                                        : null}
                                                    <button
                                                        type="button"
                                                        class="secondary delete-button"
                                                        @click=${(event: Event) =>
                                                            this.handleDeleteClick(
                                                                event,
                                                                note
                                                            )}
                                                    >
                                                        <jot-icon name="Trash2"></jot-icon>
                                                        Delete
                                                    </button>
                                                </div>
                                            </footer>
                                        </article>`
                                )}
                            </div>
                        </details>
                        <hr />`
            )}
            <div class="sticky-buttons">
                <button
                    class="inline"
                    @click=${() => this.handleNewNoteClick()}
                >
                    <jot-icon name="PenLine"></jot-icon>
                </button>
            </div>`;
    }
    static styles = [
        base,
        css`
            .notes-folder {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .note-content {
                white-space: pre-wrap;
            }
            .folderLabel {
                padding-left: 1.5rem;
                width: calc(100% - 1rem);
            }
            .notesHeader {
                padding-bottom: 0;
            }
            .edit-dates {
                display: flex;
                justify-content: flex-end;
            }
            footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.75rem;
            }
            .note-actions {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .share-button,
            .delete-button {
                display: inline-flex;
                align-items: center;
                gap: 0.35rem;
                margin-bottom: 0;
                padding: 0.35rem 0.7rem;
            }
        `,
    ];
}
