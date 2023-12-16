import {
    action,
    computed,
    makeObservable,
    observable,
    runInAction,
} from 'mobx';
import { entryDao } from '../dao/EntryDao';
import { Entry } from '../interfaces/entry.interface';
import { StatsActivityEntry } from '../interfaces/stats.interface';

const entriesData: Entry[] = await entryDao.getItems();
class EntriesStore {
    @observable
    public all: Entry[] = entriesData;
    @computed
    public get stats() {
        const activityStats = new Map<string, StatsActivityEntry>();
        let dates: { date: string; entry: Entry }[] = [];
        this.all.forEach((entry: Entry) => {
            dates.push({ date: entry.date, entry });
            for (let [activityId, detail] of Object.entries(entry.activities)) {
                if (!activityStats.has(activityId)) {
                    activityStats.set(activityId, { count: 0, dates: [] });
                }
                let activity: any = activityStats.get(activityId);
                activity.dates.push({ date: entry.date, entry });
                if (Array.isArray(detail)) {
                    if (!activity.detailsUsed) {
                        activity.detailsUsed = new Map();
                    }
                    let currentActivityDetails = activity.detailsUsed;
                    detail.forEach((detailItem) => {
                        if (!currentActivityDetails.has(detailItem))
                            currentActivityDetails.set(detailItem, {
                                count: 0,
                                text: detailItem,
                                dates: [],
                            });
                        let currentDetailItem =
                            currentActivityDetails.get(detailItem);
                        currentDetailItem.count++;
                        currentDetailItem.dates.push({
                            date: entry.date,
                            entry,
                        });
                    });
                }
            }
        });
        return activityStats;
    }
    @action.bound
    public async reset() {
        this.all = [];
        entryDao.reset();
    }
    public getEntry(id: string): Promise<Entry | undefined> {
        return entryDao.getItem(id);
    }
    @action.bound
    async upsertEntry(userEntry: Partial<Entry>) {
        await entryDao.saveItem(userEntry);
        const updatedEntries = await entryDao.getItems();
        runInAction(() => {
            this.all = updatedEntries;
        });
    }
    @action.bound
    async bulkImport(entries: Entry[]) {
        await entryDao.saveItems(entries);
        const updatedEntries = await entryDao.getItems();
        runInAction(() => {
            this.all = updatedEntries;
        });
    }
    @action.bound
    async insertEntry(userEntry: any) {
        await entryDao.saveItem(userEntry);
        const updatedEntries = await entryDao.getItems();
        runInAction(() => {
            this.all = updatedEntries;
        });
    }
    @action.bound
    public async removeEntry(id?: string) {
        await entryDao.deleteItem(id);
        const updatedEntries = await entryDao.getItems();
        runInAction(() => {
            this.all = updatedEntries;
        });
    }
    constructor() {
        makeObservable(this);
    }
}
export const entries = new EntriesStore();
