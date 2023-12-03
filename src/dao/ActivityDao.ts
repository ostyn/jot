import { Activity } from '../interfaces/activity.interface';
import { DexieDao } from './DexieDao';

export class ActivityDao extends DexieDao {
    constructor() {
        super('activities');
    }
    sortItems(items: Activity[]) {
        return items.sort((a, b) => {
            if (Number(a.isArchived) - Number(b.isArchived) !== 0)
                return Number(a.isArchived) - Number(b.isArchived);
            return a.created.localeCompare(b.created);
        });
    }
}
export const activityDao = new ActivityDao();
