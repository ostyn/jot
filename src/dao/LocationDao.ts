import { Location } from '../interfaces/entry.interface';
import { db } from '../services/Dexie';
import { DexieDao } from './DexieDao';

export class LocationDao extends DexieDao {
    constructor() {
        super('locations');
    }

    async getItems(): Promise<Location[]> {
        const locations: Location[] = await db.table('locations').toArray();
        return Promise.resolve(locations);
    }

    async getLocationById(id: string): Promise<Location | undefined> {
        if (!id) return undefined;
        return await db.table('locations').get(id);
    }

    async getLocationByPlaceName(
        placeName: string
    ): Promise<Location | undefined> {
        return await db
            .table('locations')
            .where('name')
            .equals(placeName)
            .first();
    }
}

export const locationDao = new LocationDao();
