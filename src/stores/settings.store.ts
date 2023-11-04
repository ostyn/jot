import { action, makeObservable, observable } from 'mobx';
import { makePersistable } from 'mobx-persist-store';
import { setDarkModeFromState } from '../utils/Helpers';

class SettingsStore {
    @observable
    public isDark = true;
    @action.bound
    public setIsDark(isDark: boolean) {
        setDarkModeFromState(isDark);
        this.isDark = isDark;
    }
    constructor() {
        makeObservable(this);
        makePersistable(this, {
            name: 'SettingsStore',
            properties: ['isDark'],
            storage: window.localStorage,
        });
    }
}
export const settings = new SettingsStore();
