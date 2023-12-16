import Dexie from 'dexie';

export const db = new Dexie('tracker');
db.version(1).stores({
    moods: 'id',
    activities: 'id',
    entries: 'id, dateObject',
});
