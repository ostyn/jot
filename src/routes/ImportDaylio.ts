import { parse } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';
import Papa from 'papaparse';
import { Entry } from '../interfaces/entry.interface';

export enum EditTools {
    'WEB' = 'WEB',
    'DAYLIO_IMPORT' = 'DAYLIO_IMPORT',
}

export class ImportDaylio {
    static parseCsv(
        csvString: string,
        moodMappings: { [key: string]: string },
        activityMappings: { [key: string]: string }
    ): { entries: Entry[]; moodsToMap: string[]; activitiesToMap: string[] } {
        const entries: Entry[] = [];
        const rows: any[] = Papa.parse(csvString, {
            header: true,
        }).data;
        let activitiesToMap = new Set<string>();
        let moodsToMap = new Set<string>();
        for (const row of rows) {
            const daylioActivities = row.activities.split(' | ');
            const mappedActivities: { [key: string]: any } = {};
            moodsToMap.add(row.mood);

            daylioActivities.forEach((activity: any) => {
                activitiesToMap.add(activity);
                if (activityMappings[activity] !== undefined) {
                    let mapping = activityMappings[activity];
                    mappedActivities[mapping] = 1;
                }
            });

            const full_date = row.full_date.trim();
            const parsedDate = parse(
                `${full_date} ${row.time}`,
                'yyyy-MM-dd HH:mm',
                new Date()
            );
            const timeZone = 'America/Denver';
            const zonedDate = utcToZonedTime(parsedDate, timeZone);

            const entry: Entry = {
                activities: mappedActivities,
                date: full_date,
                dateObject: full_date,
                mood: moodMappings[row.mood],
                note: row.note_title
                    ? row.note_title + '\n\n' + row.note
                    : row.note,
                created: zonedDate.toISOString(),
                createdBy: EditTools.DAYLIO_IMPORT,
                lastUpdatedBy: EditTools.DAYLIO_IMPORT,
            };
            entries.push(entry);
        }
        return {
            entries: entries,
            moodsToMap: Array.from(moodsToMap),
            activitiesToMap: Array.from(activitiesToMap),
        };
    }
}
