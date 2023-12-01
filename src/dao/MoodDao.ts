import { DexieDao } from './DexieDao';

export class MoodDao extends DexieDao {
    constructor() {
        super('moods');
    }
    sortItems(items: any) {
        return items.sort((a: any, b: any) => b.rating - a.rating);
    }
}
export const moodDao = new MoodDao();
