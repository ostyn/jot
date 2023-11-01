import { createContext } from '@lit/context';
import { persist } from 'zustand/middleware';
import { createStore, StoreApi } from 'zustand/vanilla';

export const storesContext = createContext<Stores>('storesContext');

export class Stores {
    public settings: StoreApi<any>;
    constructor() {
        this.settings = createStore(
            persist(
                (set) => ({
                    isDark: true,
                    toggleDarkMode: () =>
                        set((state: any) => ({ isDark: !state.isDark })),
                }),
                {
                    name: 'settings-store',
                }
            )
        );
        this.setDarkModeFromState(this.settings.getState());
        this.settings.subscribe(this.setDarkModeFromState);
    }

    private setDarkModeFromState = (state: any) => {
        document.documentElement.setAttribute(
            'data-theme',
            state.isDark ? 'dark' : 'light'
        );
    };
}
