import { createStore } from 'zustand/vanilla';
import { Activity } from '../interfaces/activity.interface';

const data = await (await fetch('./data.json')).json();

const activitiesData: Activity[] = data.activities;

export interface ActivitiesState {
    all: Activity[];
}
export const activities = createStore<ActivitiesState>(() => ({
    all: activitiesData,
}));
