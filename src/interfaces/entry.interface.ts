export interface Entry extends UserEditableEntryFields {
    userId?: any;
    activitiesArray?: string[];
    day?: number;
    month?: number;
    year?: number;
    lastUpdatedBy: EditTools;
    updated?: string;
    created: string;
    createdBy: EditTools;
}
export interface UserEditableEntryFields {
    id?: string;
    date: string;
    mood: string;
    activities: { [key: string]: ActivityDetail };
    note: string;
}
export type ActivityDetail = number | string[];
export enum EditTools {
    'WEB' = 'WEB',
    'DAYLIO_IMPORT' = 'DAYLIO_IMPORT',
}
