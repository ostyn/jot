import { db } from '../services/Dexie';
import { DexieDao } from './DexieDao';

export class EntryDao extends DexieDao {
    constructor() {
        super('entries');
    }
    async getEntriesFromYearAndMonth(year: number, month: number) {
        let x = await db
            .table('entries')
            .where('date')
            .startsWith(`${year}-${month < 10 ? `0${month}` : month}`)
            .reverse()
            .toArray();

        return x;
    }
    async getItems(): Promise<any> {
        return await db.table(this.name).orderBy('date').reverse().toArray();
    }
}
export const entryDao = new EntryDao();
