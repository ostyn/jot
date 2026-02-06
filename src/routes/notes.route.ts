import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { base } from '../baseStyles';
import '../components/calendar-wrapper.component';
import { notes } from '../stores/notes.store';
import { betterGo } from './route-config';

@customElement('notes-route')
export class NotesRoute extends MobxLitElement {
    private handleNoteClick(note: any) {
        betterGo('note-edit', { pathParams: { id: note.id } });
    }

    private handleNewNoteClick() {
        betterGo('note-edit');
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
        `,
    ];
}
