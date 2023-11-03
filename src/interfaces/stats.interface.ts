import { Entry } from './entry.interface';

export interface StatsActivityEntry {
    count: number;
    detailsUsed?: Map<string, StatsDetailEntry>;
    dates: { date: string; entry: Entry }[];
}
export interface StatsDetailEntry {
    count: number;
    text: string;
    dates: { date: string; entry: Entry }[];
}
