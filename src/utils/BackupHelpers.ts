import { parseISO } from 'date-fns';
import { Activity } from '../interfaces/activity.interface';
import { Entry } from '../interfaces/entry.interface';
import { Mood } from '../interfaces/mood.interface';
import { Note } from '../interfaces/note.interface';
import { db, versions } from '../services/Dexie';
import { activities } from '../stores/activities.store';
import { entries } from '../stores/entries.store';
import { moods } from '../stores/moods.store';
import { notes } from '../stores/notes.store';

export interface JsonExport {
    entries: Entry[];
    activities: Activity[];
    moods: Mood[];
    notes?: Note[];
    version: number;
}
export const createExportContents = (beautify = false) => {
    const fileContents: JsonExport = {
        entries: entries.all,
        activities: activities.all,
        moods: moods.userCreated,
        notes: notes.all,
        version: db.verno,
    };
    return JSON.stringify(fileContents, undefined, beautify ? 2 : 0);
};
export function prepJsonForImport({
    entries,
    moods,
    activities,
    notes,
    version,
}: JsonExport) {
    const importVersion = version ?? 3;
    entries.forEach((entry: Entry) => {
        versions[importVersion].importTransform(entry);
    });
    notes?.forEach((note: Note) => {
        versions[4].importTransform(note as unknown as Entry);
    });
    for (let v = importVersion + 1; v <= db.verno; v++) {
        if (versions[v]) {
            entries.forEach((entry: Entry) => {
                versions[v].upgrade(entry);
            });
        }
    }

    moods.forEach((mood: Mood) => {
        mood.created = parseISO(mood.created as unknown as string);
        mood.updated = parseISO(mood.updated as unknown as string);
    });
    activities.forEach((activity: Activity) => {
        activity.created = parseISO(activity.created as unknown as string);
        activity.updated = parseISO(activity.updated as unknown as string);
    });
}
