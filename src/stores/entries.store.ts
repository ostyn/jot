import { createStore } from 'zustand/vanilla';
import { Entry } from '../interfaces/entry.interface';

const data = await (await fetch('./data.json')).json();

const entriesData: Entry[] = data.entries;

export interface EntriesState {
    all: Entry[];
}
export const entries = createStore<EntriesState>(() => ({
    all: entriesData,
}));
