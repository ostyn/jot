export interface Entry {
    id?: string;
    date: string;
    mood: string;
    location?: { lat: number; lon: number };
    activities: { [key: string]: ActivityDetail };
    note: string;
    lastUpdatedBy: EditTools;
    updated: Date;
    created: Date;
    createdBy: EditTools;
}
export type ActivityDetail = number | string[];
export enum EditTools {
    'WEB' = 'WEB',
    'JOT' = 'JOT',
    'DAYLIO_IMPORT' = 'DAYLIO_IMPORT',
    'JSON_IMPORT' = 'JSON_IMPORT',
}
