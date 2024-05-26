import Dexie from 'dexie';

export const db = new Dexie('jot');
db.version(3).stores({
    moods: 'id',
    activities: 'id',
    entries: 'id, date',
});
