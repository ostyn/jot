export type Entry = {
    id: string;
    date: string;
    mood: string;
    location?: { lat: number; lon: number };
    activities: { [key: string]: ActivityDetail };
    note: string;
    editLog: EditLog[];
};
export type EditLog = { date: Date; duration?: number; tool: EditTools };
export type Entry_v3 = Omit<Entry, 'editLog'> & {
    updated?: Date;
    created?: Date;
    createdBy?: EditTools;
    lastUpdatedBy?: EditTools;
};
export type ActivityDetail = number | string[] | string; //string is legacy probably easier to remove and clean data

// Location metadata (reusable across any activity detail)
export type Location = {
    id: string;
    name?: string;
    description?: string;
    lat: number;
    lng: number;
    country?: string;
    city?: string;
};

// Persistent mapping: activity detail value -> location
// Allows retroactive and forward location associations for detail values
export type ActivityDetailLocationMapping = {
    id: string;
    value: string | number; // The activity detail value being mapped
    locationId: string; // References Location.id
};

export enum EditTools {
    'WEB' = 'WEB',
    'JOT' = 'JOT',
    'DAYLIO_IMPORT' = 'DAYLIO_IMPORT',
    'DAYLIO' = 'DAYLIO',
    'JSON_IMPORT' = 'JSON_IMPORT',
    'GOOGLE_IMPORT' = 'GOOGLE_IMPORT',
}
