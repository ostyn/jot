import { parseISO } from 'date-fns';
import Dexie from 'dexie';
import { EditTools, Entry, Entry_v3 } from '../interfaces/entry.interface';

export const db = new Dexie('jot');
db.version(3).stores({
    moods: 'id',
    activities: 'id',
    entries: 'id, date',
});
db.version(4)
    .stores({
        moods: 'id',
        activities: 'id',
        entries: 'id, date',
    })
    .upgrade((trans) => {
        return trans
            .table('entries')
            .toCollection()
            .modify(versions[4].upgrade);
    });
db.version(5).stores({
    moods: 'id',
    activities: 'id',
    entries: 'id, date',
    notes: 'id, date, path',
});
export interface EntryVersion {
    version: number;
    description: string;
    needsToRun: (entry: Entry) => boolean;
    upgrade: (entry: Entry) => void;
    importTransform: (entry: Entry) => void;
}
export const versions: { [key: number]: EntryVersion } = {
    3: {
        version: 3,
        description:
            'Everything before version 4. This is really just here for the importTransform',
        needsToRun: () => false,
        upgrade: () => {},
        importTransform: (entry: Entry_v3) => {
            if (typeof entry.created === 'string')
                entry.created = parseISO(entry.created as unknown as string);
            if (typeof entry.updated === 'string')
                entry.updated = parseISO(entry.updated as unknown as string);
        },
    },
    4: {
        version: 4,
        description: 'Add editLog to entries',
        needsToRun: (entry: Entry) => entry.editLog === undefined,
        upgrade: (entry: Entry_v3) => {
            const updatedEntry: Entry = entry as Entry;
            updatedEntry.editLog = [
                {
                    date: entry.created as Date,
                    tool: entry.createdBy as EditTools,
                },
            ];
            if (
                entry.updated &&
                entry.updated.getTime() !== entry.created?.getTime()
            ) {
                updatedEntry.editLog.push({
                    date: entry.updated,
                    tool: entry.lastUpdatedBy as EditTools,
                });
            }
            delete entry.lastUpdatedBy;
            delete entry.updated;
            delete entry.created;
            delete entry.createdBy;
        },
        importTransform: (entry: Entry) => {
            for (const log of entry.editLog) {
                log.date = parseISO(log.date as unknown as string);
            }
        },
    },
    5: {
        version: 5,
        description: 'Added notes',
        needsToRun: () => false,
        upgrade: (entry: Entry) => entry,
        importTransform: (entry: Entry) => {
            for (const log of entry.editLog) {
                log.date = parseISO(log.date as unknown as string);
            }
        },
    },
};
