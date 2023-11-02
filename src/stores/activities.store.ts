import { createStore } from 'zustand/vanilla';
import { Activity } from '../interfaces/activity.interface';

const data = await (await fetch('./data.json')).json();

const activitiesData: Activity[] = data.activities;

export interface ActivitiesState {
    addActivity(activity: Activity): void;
    updateActivity(activity: Activity): void;
    removeActivity(id: string): void;
    getCategories(): string[];
    all: Activity[];
}
export const activities = createStore<ActivitiesState>((set, get) => ({
    all: activitiesData,
    getCategories: () => {
        return [...new Set(get().all.map((a) => a.category || ''))];
    },
    addActivity: (activity: Activity) =>
        set((state) => ({
            all: [...state.all, { ...activity, id: Math.random().toString() }],
        })),
    updateActivity: (updatedActivity: Activity) =>
        set((state) => ({
            all: [
                ...state.all.filter(
                    (activity) => activity.id !== updatedActivity.id
                ),
                updatedActivity,
            ],
        })),
    removeActivity: (id: string) =>
        set((state) => ({
            all: [...state.all.filter((activity) => activity.id !== id)],
        })),
}));
