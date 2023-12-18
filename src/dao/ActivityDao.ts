import { DexieDao } from './DexieDao';

export class ActivityDao extends DexieDao {
    constructor() {
        super('activities');
    }
}
export const activityDao = new ActivityDao();
