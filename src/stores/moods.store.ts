import { action, computed, makeObservable, observable } from 'mobx';
import { v4 as uuidv4 } from 'uuid';
import { Mood } from '../interfaces/mood.interface';

const moodsData: Mood[] = [];

class MoodStore {
    @observable
    public userCreated: Mood[] = moodsData;
    public default: Mood[] = [
        {
            emoji: '🚧',
            id: '0',
            rating: '3',
            name: 'TBD',
        },
    ];
    @computed
    public get all() {
        return [...this.userCreated, ...this.default];
    }

    @action.bound
    public addMood(mood: Mood) {
        this.userCreated.push({ ...mood, id: uuidv4() });
        this.userCreated.sort((a: Mood, b: Mood) =>
            b.rating.localeCompare(a.rating)
        );
    }
    @action.bound
    public updateMood(updatedMood: Mood) {
        const existingIndex = this.userCreated.findIndex(
            (mood) => mood.id === updatedMood.id
        );
        this.userCreated[existingIndex] = updatedMood;
        this.userCreated.sort((a: Mood, b: Mood) =>
            b.rating.localeCompare(a.rating)
        );
    }
    @action.bound
    bulkImport(moods: Mood[]) {
        this.userCreated.push(...moods);
        this.userCreated.sort((a: Mood, b: Mood) =>
            b.rating.localeCompare(a.rating)
        );
    }
    @action.bound
    public removeMood(id: string) {
        this.userCreated = this.userCreated.filter((mood) => mood.id !== id);
    }
    public getMood(id: string): Mood | undefined {
        return this.all.find((mood) => mood.id === id);
    }
    constructor() {
        makeObservable(this);
    }
}
export const moods = new MoodStore();
