import { action, makeObservable, observable, runInAction } from 'mobx';
import { notesDao } from '../dao/NotesDao';
import { EditTools } from '../interfaces/entry.interface';
import { Note, NoteTools } from '../interfaces/note.interface';

const notesData: Note[] = await notesDao.getItems();
if (notesData.length === 0) {
    notesDao.saveItem({
        path: '',
        content:
            'Happy Birthday Ranger!\nYou are now 13 years old. You are officially a teenager. You are growing up so fast. I am so proud of you. I love you so much. I hope you have a great day. Love, Jared',
        editLog: [{ date: new Date(), duration: 100000, tool: EditTools.JOT }],
    });
}
class NotesStore {
    @observable
    public all: Note[] = notesData;
    @action.bound
    public async reset() {
        this.all = [];
        notesDao.reset();
    }
    public getNotesObjectByPath(): { [key: string]: Note[] } {
        const notesByPath: { [key: string]: Note[] } = {};
        this.all.forEach((note) => {
            const path = note.path || '';
            if (!notesByPath[path]) {
                notesByPath[path] = [];
            }
            notesByPath[path].push(note);
        });
        return notesByPath;
    }
    public getNotePaths(): string[] {
        return Array.from(new Set(this.all.map((note) => note.path)));
    }
    @action.bound
    async upsertNote(userNote: Partial<Note>) {
        await notesDao.saveItem(userNote);
        const updatedNotes = await notesDao.getItems();
        runInAction(() => {
            this.all = updatedNotes;
        });
    }
    @action.bound
    async bulkImport(notes: Note[], importTool: NoteTools) {
        await notesDao.saveItems(notes, importTool as EditTools);
        const updatedNotes = await notesDao.getItems();
        runInAction(() => {
            this.all = updatedNotes;
        });
    }
    @action.bound
    async insertNote(userNote: any) {
        await notesDao.saveItem(userNote);
        const updatedNotes = await notesDao.getItems();
        runInAction(() => {
            this.all = updatedNotes;
        });
    }
    @action.bound
    public async removeNote(id?: string) {
        await notesDao.deleteItem(id);
        const updatedNotes = await notesDao.getItems();
        runInAction(() => {
            this.all = updatedNotes;
        });
    }
    constructor() {
        makeObservable(this);
    }
}
export const notes = new NotesStore();
