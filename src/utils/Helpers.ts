import { LitElement } from 'lit';

export class Helpers {
    public static isNumeric(str: any) {
        if (typeof str == 'number') return true;
        if (typeof str !== 'string') return false; // we only process strings!
        return (
            !isNaN(str as any) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
            !isNaN(parseFloat(str))
        ); // ...and ensure strings of whitespace fail
    }
}

export const setDarkModeFromState = (isDark: boolean) => {
    document.documentElement.setAttribute(
        'data-theme',
        isDark ? 'dark' : 'light'
    );
};
export const dispatchEvent = function (
    element: LitElement,
    event: Events,
    data: any = undefined
) {
    element.dispatchEvent(
        new CustomEvent(event.toString(), {
            detail: data,
        })
    );
};

export enum Events {
    monthChange = 'monthChange',
    monthClick = 'monthClick',
    moodDeleted = 'moodDeleted',
    moodSubmitted = 'moodSubmitted',
    activityDeleted = 'activityDeleted',
    activitySubmitted = 'activitySubmitted',
    activityDetailSelected = 'activityDetailSelected',
    textSheetDismissed = 'textSheetDismissed',
    activityClick = 'activityClick',
    activityLongClick = 'activityLongClick',
}
