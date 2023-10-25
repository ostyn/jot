import { Entry } from './entry.interface';

export interface IStatsActivityEntry {
    count: number;
    detailsUsed?: Map<string, IStatsDetailEntry>;
    dates: { date: string; entry: Entry }[];
}
export interface IStatsDetailEntry {
    count: number;
    text: string;
    dates: { date: string; entry: Entry }[];
}
