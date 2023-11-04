import { action, makeObservable, observable } from 'mobx';
import { Mood } from '../interfaces/mood.interface';

const data = await (await fetch('./data.json')).json();

const moodsData: Mood[] = data.moods;

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
    public get all() {
        return [...this.userCreated, ...this.default];
    }

    @action.bound
    public addMood(mood: Mood) {
        this.userCreated.push({ ...mood, id: Math.random().toString() });
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
    public removeMood(id: string) {
        this.userCreated = this.userCreated.filter((mood) => mood.id !== id);
    }
    public getMood(id: string): Mood | undefined {
        console.log('ewok');
        return this.userCreated.find((mood) => mood.id === id);
    }
    constructor() {
        makeObservable(this);
    }
}
export const moods = new MoodStore();
