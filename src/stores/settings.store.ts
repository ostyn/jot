import { action, makeObservable, observable } from 'mobx';
import { setDarkModeFromState } from '../utils/Helpers';
import { activities } from './activities.store';

class SettingsStore {
    @observable
    public isDark = true;
    @observable
    public showArchived = true;
    @action.bound
    public setIsDark(isDark: boolean) {
        setDarkModeFromState(isDark);
        this.isDark = isDark;
        localStorage.setItem('isDark', `${this.isDark}`);
    }
    @action.bound
    public setShowArchived(showArchived: boolean) {
        activities.refreshActivities();
        this.showArchived = showArchived;
        localStorage.setItem('showArchived', `${this.showArchived}`);
    }
    constructor() {
        makeObservable(this);
        this.isDark = window.localStorage.getItem('isDark') === 'true';
        this.showArchived =
            window.localStorage.getItem('showArchived') === 'true';
    }
}
export const settings = new SettingsStore();
