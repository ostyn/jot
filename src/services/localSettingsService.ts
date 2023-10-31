import { createContext } from '@lit/context';

export const localSettingsService = createContext<LocalSettingsService>(
    'localSettingsService'
);
export class LocalSettingsService {
    public isDark: boolean = true;
    constructor() {
        this.setTheme(localStorage.getItem('isDark') == 'true');
    }
    public toggleNightMode() {
        this.setTheme(!this.isDark);
    }
    private setTheme(isDark: boolean) {
        this.isDark = isDark;
        document.documentElement.setAttribute(
            'data-theme',
            isDark ? 'dark' : 'light'
        );
        localStorage.setItem('isDark', isDark.toString());
    }
}
