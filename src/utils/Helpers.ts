import { LitElement } from 'lit';

export class Helpers {
    public static isNumeric(str: any): boolean {
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
            bubbles: true,
            composed: true,
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
    mapSheetDismissed = 'mapSheetDismissed',
    activityClick = 'activityClick',
    activityDetailClick = 'activityDetailClick',
    activityLongClick = 'activityLongClick',
    activityDoubleClick = 'activityDoubleClick',
    dateSelect = 'dateSelect',
    monthSelect = 'monthSelect',
    viewChange = 'viewChange',
}
export function timer(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function xmlToJson(xmlString: string): Record<string, any> {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
    const result: Record<string, any> = {};

    function processNode(node: Element): any {
        const children = Array.from(node.children);
        if (children.length > 0) {
            const obj: Record<string, any> = {};
            children.forEach((child) => {
                const key = child.nodeName;
                const value = processNode(child);
                if (obj[key]) {
                    if (!Array.isArray(obj[key])) {
                        obj[key] = [obj[key]];
                    }
                    obj[key].push(value);
                } else {
                    obj[key] = value;
                }
            });
            return obj;
        }

        return node.textContent || null;
    }

    const root = xmlDoc.documentElement;
    if (root) {
        result[root.nodeName] = processNode(root);
    }

    return result;
}
