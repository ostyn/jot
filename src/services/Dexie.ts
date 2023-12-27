import Dexie from 'dexie';

export const db = new Dexie('jot');
db.version(1).stores({
    moods: 'id',
    activities: 'id',
    entries: 'id, dateObject',
});
