import { db } from '../services/Dexie';
import { DexieDao } from './DexieDao';

export class EntryDao extends DexieDao {
    constructor() {
        super('entries');
    }
    async getEntriesFromYearAndMonth(year: number, month: number) {
        let x = await db
            .table('entries')
            .where('dateObject')
            .between(new Date(year, month - 1, 1), new Date(year, month, 1))
            .reverse()
            .toArray();

        return x;
    }
}
export const entryDao = new EntryDao();
