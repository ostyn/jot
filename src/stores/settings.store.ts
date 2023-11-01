import { persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

export interface SettingState {
    isDark: boolean;
    toggleDarkMode: () => void;
}

export const settings = createStore<SettingState>()(
    persist(
        (set) => ({
            isDark: true,
            toggleDarkMode: () => set((state) => ({ isDark: !state.isDark })),
        }),
        {
            name: 'settings-store',
        }
    )
);
