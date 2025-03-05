export type Entry = {
    id?: string;
    date: string;
    mood: string;
    location?: { lat: number; lon: number };
    activities: { [key: string]: ActivityDetail };
    note: string;
    editLog: { date: Date; duration?: number; tool: EditTools }[];
};
export type Entry_v3 = Omit<Entry, 'editLog'> & {
    updated?: Date;
    created?: Date;
    createdBy?: EditTools;
    lastUpdatedBy?: EditTools;
};
export type ActivityDetail = number | string[];
export enum EditTools {
    'WEB' = 'WEB',
    'JOT' = 'JOT',
    'DAYLIO_IMPORT' = 'DAYLIO_IMPORT',
    'DAYLIO' = 'DAYLIO',
    'JSON_IMPORT' = 'JSON_IMPORT',
    'GOOGLE_IMPORT' = 'GOOGLE_IMPORT',
}
