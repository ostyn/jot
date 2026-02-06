import { TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { toJS } from 'mobx';
import '../components/action-sheets/text.sheet';
import { TextSheet } from '../components/action-sheets/text.sheet';
import { EditTools } from '../interfaces/entry.interface';
import { notes } from '../stores/notes.store';
import { AbstractSheetRoute } from './AbstractSheetRoute';

@customElement('note-edit-route')
export class NoteEditRoute extends AbstractSheetRoute {
    @state() noteData: any = null;
    @state() isNewNote: boolean = true;
    startEdit: Date = new Date();
    openedHeight: number = 100;

    async onBeforeEnter(location: any) {
        await super.onBeforeEnter(location);
        this.startEdit = new Date();

        const noteId = location.params?.id;
        if (noteId) {
            this.noteData = notes.getNoteById(noteId);
            this.isNewNote = false;
        } else {
            this.noteData = null;
            this.isNewNote = true;
        }
    }

    private handleNoteSubmit(content: string) {
        const endEdit = new Date();
        if (this.isNewNote) {
            if (content !== '') {
                notes.insertNote({
                    path: '',
                    content,
                    editLog: [
                        {
                            date: endEdit,
                            duration:
                                endEdit.getTime() - this.startEdit.getTime(),
                            tool: EditTools.JOT,
                        },
                    ],
                });
            }
        } else {
            const updatedNote = {
                id: this.noteData.id,
                path: this.noteData.path,
                content,
                editLog: [
                    ...toJS(this.noteData.editLog),
                    {
                        date: endEdit,
                        duration: endEdit.getTime() - this.startEdit.getTime(),
                        tool: EditTools.JOT,
                    },
                ],
            };
            if (content === '') {
                notes.removeNote(updatedNote.id);
            } else if (content !== this.noteData.content) {
                notes.upsertNote(updatedNote);
            }
        }
    }

    renderSheetContent(): TemplateResult {
        return TextSheet.getActionSheet(
            this.isNewNote ? '' : this.noteData.content,
            (content: string) => this.handleNoteSubmit(content)
        );
    }
}
