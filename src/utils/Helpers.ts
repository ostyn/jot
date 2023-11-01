import { SettingState } from '../stores/settings.store';

export class Helpers {
    public static isNumeric(str: any) {
        if (typeof str == 'number') return true;
        if (typeof str !== 'string') return false; // we only process strings!
        return (
            !isNaN(str as any) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
            !isNaN(parseFloat(str))
        ); // ...and ensure strings of whitespace fail
    }
    public static setDarkModeFromState = (state: SettingState) => {
        document.documentElement.setAttribute(
            'data-theme',
            state.isDark ? 'dark' : 'light'
        );
    };
}
