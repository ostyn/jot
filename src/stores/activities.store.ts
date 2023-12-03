import { action, makeObservable, observable, runInAction } from 'mobx';
import { activityDao } from '../dao/ActivityDao';
import { Activity } from '../interfaces/activity.interface';

const activitiesData: Activity[] = await activityDao.getItems();
class ActivityStore {
    @observable
    public all: Activity[] = activitiesData;
    @action.bound
    public async updateActivity(updatedActivity: Activity) {
        await activityDao.saveItem(updatedActivity);
        const updatedActivities = await activityDao.getItems();
        runInAction(() => {
            this.all = updatedActivities;
        });
    }
    @action.bound
    public async bulkImport(activities: Activity[]) {
        await activityDao.saveItems(activities);
        const updatedActivities = await activityDao.getItems();
        runInAction(() => {
            this.all = updatedActivities;
        });
    }
    @action.bound
    public async removeActivity(id: string) {
        await activityDao.deleteItem(id);
        const updatedActivities = await activityDao.getItems();
        runInAction(() => {
            this.all = updatedActivities;
        });
    }
    public getActivity(id: string): Promise<Activity | undefined> {
        return activityDao.getItem(id);
    }
    public getCategories() {
        return [...new Set(this.all.map((a) => a.category || ''))].sort();
    }
    constructor() {
        makeObservable(this);
    }
}
export const activities = new ActivityStore();
