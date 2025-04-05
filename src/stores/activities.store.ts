import {
    action,
    computed,
    makeObservable,
    observable,
    runInAction,
} from 'mobx';
import { activityDao } from '../dao/ActivityDao';
import { Activity } from '../interfaces/activity.interface';
import { EditTools, Entry } from '../interfaces/entry.interface';
import {
    StatsActivityEntry,
    StatsDetailEntry,
} from '../interfaces/stats.interface';
import { entries } from './entries.store';
import { settings } from './settings.store';

const activitiesData: Activity[] = await activityDao.getItems();
const activitiesMap: any = {};
activitiesData.forEach((activity) => {
    activitiesMap[activity.id] = activity;
});
class ActivityStore {
    @observable
    public allVisibleActivities: Activity[] = activitiesData;
    @observable
    public all: Activity[] = activitiesData;
    @observable
    map: any = activitiesMap;
    @action.bound
    public async reset() {
        this.all = [];
        this.allVisibleActivities = [];
        this.map = {};
        activityDao.reset();
    }
    @action.bound
    public async updateActivity(updatedActivity: Activity) {
        await activityDao.saveItem(updatedActivity);
        await this.refreshActivities();
    }
    @action.bound
    public async bulkImport(activities: Activity[], importTool: EditTools) {
        await activityDao.saveItems(activities, importTool);
        await this.refreshActivities();
    }
    @action.bound
    public async removeActivity(id: string) {
        await activityDao.deleteItem(id);
        await this.refreshActivities();
    }
    @action.bound
    public async refreshActivities() {
        let allActivities: Activity[] = await activityDao.getItems();
        let allVisibleActivities = [...allActivities];
        if (!settings.showArchived)
            allVisibleActivities = allVisibleActivities.filter(
                (activity) => !activity.isArchived
            );
        runInAction(() => {
            this.allVisibleActivities = allVisibleActivities;
            this.all = allActivities;
            this.map = {};
            this.allVisibleActivities.forEach((activity) => {
                this.map[activity.id] = activity;
            });
        });
    }
    getActivityDetailStats(
        activityId: string,
        filter: (detail: StatsDetailEntry) => boolean = (_) => true
    ): {
        mfuDetails: StatsDetailEntry[];
        mruDetails: StatsDetailEntry[];
    } {
        let activityDetailStats: {
            mfuDetails: StatsDetailEntry[];
            mruDetails: StatsDetailEntry[];
        } = {
            mfuDetails: [],
            mruDetails: [],
        };

        const map: Map<string, StatsDetailEntry> =
            activities.stats.get(activityId)?.detailsUsed || new Map();
        activityDetailStats.mfuDetails = Array.from(map.values()).filter(
            filter as any
        );
        activityDetailStats.mfuDetails = activityDetailStats.mfuDetails.sort(
            (a, b) => {
                return b.count - a.count;
            }
        );
        activityDetailStats.mfuDetails = activityDetailStats.mfuDetails.slice(
            0,
            Math.min(10, activityDetailStats.mfuDetails.length)
        );

        activityDetailStats.mruDetails = Array.from(map.values()).filter(
            filter as any
        );
        activityDetailStats.mruDetails = activityDetailStats.mruDetails.sort(
            (a: StatsDetailEntry, b: StatsDetailEntry) => {
                return (
                    b.dates[0].date.localeCompare(a.dates[0].date) ||
                    b.count - a.count
                );
            }
        );
        activityDetailStats.mruDetails = activityDetailStats.mruDetails.slice(
            0,
            Math.min(10, activityDetailStats.mruDetails.length)
        );
        return activityDetailStats;
    }
    @computed
    public get stats() {
        const activityStats = new Map<string, StatsActivityEntry>();
        let dates: { date: string; entry: Entry }[] = [];
        entries.all.forEach((entry: Entry) => {
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
    public getActivity(id: string): Activity | undefined {
        return this.map[id];
    }
    public getCategories() {
        return [
            ...new Set(
                this.allVisibleActivities
                    .map((a) => a.category)
                    .filter((i) => i !== undefined)
            ),
        ].sort();
    }
    constructor() {
        makeObservable(this);
    }
}
export const activities = new ActivityStore();
