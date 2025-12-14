import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { MobxLitElement } from '@adobe/lit-mobx';
import { toJS } from 'mobx';
import { base } from '../baseStyles';
import { Sheet } from '../components/action-sheets/action-sheet';
import { TextSheet } from '../components/action-sheets/text.sheet';
import '../components/calendar-wrapper.component';
import { EditTools } from '../interfaces/entry.interface';
import { notes } from '../stores/notes.store';

@customElement('notes-route')
export class NotesRoute extends MobxLitElement {
    render() {
        return html`<article class="notesHeader">
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
                                            @click=${() => {
                                                const startEdit = new Date();
                                                Sheet.open({
                                                    type: TextSheet,
                                                    data: note.content,
                                                    onClose: (
                                                        content: string
                                                    ) => {
                                                        const endEdit =
                                                            new Date();
                                                        const updatedNote = {
                                                            id: note.id,
                                                            path: note.path,
                                                            content,
                                                            editLog: [
                                                                ...toJS(
                                                                    note.editLog
                                                                ),
                                                                {
                                                                    date: endEdit,
                                                                    duration:
                                                                        endEdit.getTime() -
                                                                        startEdit.getTime(),
                                                                    tool: EditTools.JOT,
                                                                },
                                                            ],
                                                        };
                                                        if (
                                                            updatedNote.content ===
                                                            ''
                                                        )
                                                            notes.removeNote(
                                                                updatedNote.id
                                                            );
                                                        else if (
                                                            updatedNote.content !==
                                                            note.content
                                                        )
                                                            notes.upsertNote(
                                                                updatedNote
                                                            );
                                                    },
                                                });
                                            }}
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
                    @click=${() => {
                        const startEdit = new Date();
                        Sheet.open({
                            type: TextSheet,
                            data: '',
                            onClose: (content: string) => {
                                const endEdit = new Date();
                                if (content !== '')
                                    notes.insertNote({
                                        path: '',
                                        content,
                                        editLog: [
                                            {
                                                date: endEdit,
                                                duration:
                                                    endEdit.getTime() -
                                                    startEdit.getTime(),
                                                tool: EditTools.JOT,
                                            },
                                        ],
                                    });
                            },
                        });
                    }}
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
