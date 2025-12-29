import { Entry } from '../interfaces/entry.interface';
import { db } from '../services/Dexie';
import { DexieDao } from './DexieDao';

export class EntryDao extends DexieDao {
    constructor() {
        super('entries');
    }
    async getEntriesFromDate(date: string): Promise<Entry[]> {
        let x = await db
            .table('entries')
            .where('date')
            .startsWith(date)
            .reverse()
            .toArray();

        return x;
    }
    async getEntriesFromYearAndMonth(
        year: number,
        month?: number,
        day?: number
    ): Promise<Entry[]> {
        let startsWithQuery = `${year}-`;
        if (month !== undefined) {
            startsWithQuery += month < 10 ? `0${month}-` : `${month}-`;
            if (day !== undefined) {
                startsWithQuery += day < 10 ? `0${day}` : `${day}`;
            }
        }
        return this.getEntriesFromDate(startsWithQuery);
    }
    async getEntriesBetweenDates(startDate: Date, endDate: Date) {
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        let x = await db
            .table('entries')
            .where('date')
            .between(startDateStr, endDateStr, true, true)
            .reverse()
            .toArray();

        return x;
    }
    async getEntriesBetweenDateStrings(startDate: string, endDate: string) {
        let x = await db
            .table('entries')
            .where('date')
            .between(startDate, endDate, true, true)
            .reverse()
            .toArray();

        return x;
    }
    async getItems(): Promise<any> {
        return await db.table(this.name).orderBy('date').reverse().toArray();
    }
}
export const entryDao = new EntryDao();
