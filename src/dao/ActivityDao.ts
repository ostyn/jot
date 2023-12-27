import { Activity } from '../interfaces/activity.interface';
import { db } from '../services/Dexie';
import { DexieDao } from './DexieDao';

export class ActivityDao extends DexieDao {
    constructor() {
        super('activities');
    }
    async getItems(): Promise<any> {
        const activities: Activity[] = await db.table('activities').toArray();
        activities.sort((a, b) => {
            if (a.isArchived === b.isArchived)
                return a.name.localeCompare(b.name);
            else if (a.isArchived) return 1;
            else return -1;
        });
        return Promise.resolve(activities);
    }
}
export const activityDao = new ActivityDao();
