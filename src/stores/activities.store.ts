import { action, makeObservable, observable, runInAction } from 'mobx';
import { activityDao } from '../dao/ActivityDao';
import { Activity } from '../interfaces/activity.interface';
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
    public async bulkImport(activities: Activity[]) {
        await activityDao.saveItems(activities);
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
