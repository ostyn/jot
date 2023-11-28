import { action, makeObservable, observable } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import { Activity } from '../interfaces/activity.interface';

const activitiesData: Activity[] = [];
class ActivityStore {
    @observable
    public all: Activity[] = activitiesData;

    @action.bound
    public addActivity(activity: Activity) {
        const dateString = new Date().toISOString();
        this.all.push({
            ...activity,
            id: uuidv4(),
            updated: dateString,
            created: dateString,
        });
        this.sort();
    }
    @action.bound
    public updateActivity(updatedActivity: Activity) {
        this.all = [
            ...this.all.filter(
                (activity) => activity.id !== updatedActivity.id
            ),
            { ...updatedActivity, updated: new Date().toISOString() },
        ];
        this.sort();
    }
    @action.bound
    bulkImport(activities: Activity[]) {
        this.all.push(...activities);
        this.sort();
    }
    @action.bound
    public removeActivity(id: string) {
        this.all = this.all.filter((activity) => activity.id !== id);
    }
    public getActivity(id: string): Activity | undefined {
        return this.all.find((activity) => activity.id === id);
    }
    public getCategories() {
        return [...new Set(this.all.map((a) => a.category || ''))];
    }
    private sort() {
        this.all.sort((a, b) => {
            if (Number(a.isArchived) - Number(b.isArchived) !== 0)
                return Number(a.isArchived) - Number(b.isArchived);
            return a.created.localeCompare(b.created);
        });
    }
    constructor() {
        makeObservable(this);
    }
}
export const activities = new ActivityStore();
