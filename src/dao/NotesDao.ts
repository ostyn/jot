import { EditTools } from '../interfaces/entry.interface';
import { Note } from '../interfaces/note.interface';
import { DexieDao } from './DexieDao';

export class NotesDao extends DexieDao {
    constructor() {
        super('notes');
    }
    saveItem(passedEntry: Note): Promise<any> {
        passedEntry = this.updateItemPath(passedEntry);
        return super.saveItem(passedEntry);
    }
    saveItems(passedItems: any[], importTool: EditTools): Promise<any> {
        passedItems.forEach((item) => {
            this.updateItemPath(item);
        });
        return super.saveItems(passedItems, importTool);
    }
    private updateItemPath(item: Note): Note {
        if (item.content && item.content.length > 0) {
            const lastLine = item.content.split('\n').pop();
            if (lastLine?.startsWith('#')) {
                item.path = lastLine.substring(1).trim();
            }
        }
        return item;
    }
}
export const notesDao = new NotesDao();
