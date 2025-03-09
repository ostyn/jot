import { DexieDao } from './DexieDao';

export class NotesDao extends DexieDao {
    constructor() {
        super('notes');
    }
}
export const notesDao = new NotesDao();
