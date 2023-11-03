import { createStore } from 'zustand/vanilla';
import { Entry } from '../interfaces/entry.interface';
import { StatsActivityEntry } from '../interfaces/stats.interface';

const data = await (await fetch('./data.json')).json();

const entriesData: Entry[] = data.entries;
export const activityStats = new Map<string, StatsActivityEntry>();
let dates: { date: string; entry: Entry }[] = [];
entriesData.forEach((entry: Entry) => {
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
                let currentDetailItem = currentActivityDetails.get(detailItem);
                currentDetailItem.count++;
                currentDetailItem.dates.push({ date: entry.date, entry });
            });
        }
    }
});

export interface EntriesState {
    all: Entry[];
}
export const entries = createStore<EntriesState>(() => ({
    all: entriesData,
}));
