export interface Entry {
    userId?: any;
    activitiesArray?: string[];
    day?: number;
    month?: number;
    year?: number;
    lastUpdatedBy?: EditTools;
    updated?: Date;
    created?: Date;
    id?: string;
    date: string;
    mood: string;
    activities: Map<string, ActivityDetail>;
    note: string;
    createdBy: EditTools;
}
export type ActivityDetail = number | string[];
export enum EditTools {
    'WEB' = 'WEB',
    'DAYLIO_IMPORT' = 'DAYLIO_IMPORT',
}
