import { createStore } from 'zustand/vanilla';
import { Mood } from '../interfaces/mood.interface';

const data = await (await fetch('./data.json')).json();

const moodsData: Mood[] = data.moods;

export interface MoodsState {
    all: () => Mood[];
    userCreated: Mood[];
    default: Mood[];
    addMood: (mood: Mood) => void;
    updateMood: (mood: Mood) => void;
    removeMood: (id: string) => void;
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
    addMood: (mood: Mood) =>
        set((state) => ({
            userCreated: [
                ...state.userCreated,
                { ...mood, id: Math.random().toString() },
            ].sort((a, b) => b.rating - a.rating),
        })),
    updateMood: (updatedMood: Mood) =>
        set((state) => ({
            userCreated: [
                ...state.userCreated.filter(
                    (mood) => mood.id !== updatedMood.id
                ),
                updatedMood,
            ].sort((a, b) => b.rating - a.rating),
        })),
    removeMood: (id: string) =>
        set((state) => ({
            userCreated: [
                ...state.userCreated.filter((mood) => mood.id !== id),
            ],
        })),
}));
