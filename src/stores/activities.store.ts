import { action, makeObservable, observable } from 'mobx';
import { Activity } from '../interfaces/activity.interface';

const data = await (await fetch('/data.json')).json();

const activitiesData: Activity[] = data.activities;
class ActivityStore {
    @observable
    public all: Activity[] = activitiesData;

    @action.bound
    public addActivity(activity: Activity) {
        const dateString = new Date().toUTCString();
        this.all.push({
            ...activity,
            id: Math.random().toString(),
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
            { ...updatedActivity, updated: new Date().toUTCString() },
        ];
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
