import { Activity } from '../interfaces/activity.interface';
import { DexieDao } from './DexieDao';

export class ActivityDao extends DexieDao {
    constructor() {
        super('activities');
    }
    sortItems(items: Activity[]) {
        return items;
    }
}
export const activityDao = new ActivityDao();
