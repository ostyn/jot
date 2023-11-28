import { parseISO } from 'date-fns';
import { action, computed, makeObservable, observable } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import {
    EditTools,
    Entry,
    UserEditableEntryFields,
} from '../interfaces/entry.interface';
import { StatsActivityEntry } from '../interfaces/stats.interface';

const entriesData: Entry[] = [];
entriesData.forEach((entry) => (entry.dateObject = parseISO(entry.date)));

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
    public getEntry(id: string): Entry | undefined {
        return this.all.find((entry) => entry.id === id);
    }
    @action.bound
    upsertEntry(userEntry: UserEditableEntryFields) {
        const existingEntryIndex = this.all.findIndex(
            (entry) => entry.id === userEntry.id
        );
        if (existingEntryIndex >= 0) {
            let newEntry: Entry = {
                ...this.all[existingEntryIndex],
                ...userEntry,
                lastUpdatedBy: EditTools.WEB,
                updated: new Date().toISOString(),
            };
            this.all[existingEntryIndex] = newEntry;
            this.all.sort((a, b) => {
                return b.date.localeCompare(a.date);
            });
        } else {
            this.insertEntry(userEntry);
        }
    }
    @action.bound
    bulkImport(entries: Entry[]) {
        entries.forEach((entry) => (entry.dateObject = parseISO(entry.date)));
        this.all.push(...entries);
        this.all.sort((a, b) => {
            return b.date.localeCompare(a.date);
        });
    }
    @action.bound
    insertEntry(userEntry: UserEditableEntryFields) {
        const date = new Date().toISOString();
        let newEntry: Entry = {
            ...userEntry,
            createdBy: EditTools.WEB,
            id: uuidv4(),
            lastUpdatedBy: EditTools.WEB,
            created: date,
            updated: date,
            dateObject: parseISO(userEntry.date),
        };
        this.all.push(newEntry);
        this.all.sort((a, b) => {
            return b.date.localeCompare(a.date);
        });
    }
    @action.bound
    public removeEntry(id?: string) {
        this.all = this.all.filter((entry) => entry.id !== id);
    }
    constructor() {
        makeObservable(this);
    }
}
export const entries = new EntriesStore();
