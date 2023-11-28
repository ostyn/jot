import { action, makeObservable, observable } from 'mobx';
import { setDarkModeFromState } from '../utils/Helpers';

class SettingsStore {
    @observable
    public isDark = true;
    @action.bound
    public setIsDark(isDark: boolean) {
        setDarkModeFromState(isDark);
        this.isDark = isDark;
        localStorage.setItem('isDark', `${this.isDark}`);
    }
    constructor() {
        makeObservable(this);
        this.isDark = window.localStorage.getItem('isDark') === 'true';
    }
}
export const settings = new SettingsStore();
