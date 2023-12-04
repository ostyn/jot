export interface Entry {
    id?: string;
    date: string;
    mood: string;
    activities: { [key: string]: ActivityDetail };
    note: string;
    lastUpdatedBy: EditTools;
    updated: Date;
    created: Date;
    createdBy: EditTools;
    dateObject: Date;
}
export type ActivityDetail = number | string[];
export enum EditTools {
    'WEB' = 'WEB',
    'DAYLIO_IMPORT' = 'DAYLIO_IMPORT',
    'JSON_IMPORT' = 'JSON_IMPORT',
}
