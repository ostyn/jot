import { createStore } from 'zustand/vanilla';
import { Mood } from '../interfaces/mood.interface';

const data = await (await fetch('./data.json')).json();

const moodsData: Mood[] = data.moods;

export interface MoodsState {
    all: () => Mood[];
    userCreated: Mood[];
    default: Mood[];
    addMood: (mood?: Mood) => void;
}
let x = 1;
export const moods = createStore<MoodsState>((set, get) => ({
    userCreated: moodsData,
    default: [
        {
            emoji: '🚧',
            id: '0',
            rating: '3',
            name: 'TBD',
        },
    ],
    all: () => [...get().userCreated, ...get().default],
    addMood: (
        mood: Mood = {
            emoji: '💾',
            id: x++ + '',
            rating: '3',
            name: 'TBD',
        }
    ) =>
        set((state) => ({
            userCreated: [...state.userCreated, mood],
        })),
}));
