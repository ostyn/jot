import {
    ActivityDetailLocationMapping,
    Location,
} from '../interfaces/entry.interface';
import { db } from '../services/Dexie';
import { DexieDao } from './DexieDao';
import { locationDao } from './LocationDao';

export class ActivityDetailLocationMappingDao extends DexieDao {
    constructor() {
        super('activityDetailLocationMappings');
    }

    async getItems(): Promise<ActivityDetailLocationMapping[]> {
        return await db.table('activityDetailLocationMappings').toArray();
    }

    /**
     * Get location mapping for a specific activity detail value
     */
    async getMappingByValue(
        value: string | number
    ): Promise<ActivityDetailLocationMapping | undefined> {
        return await db
            .table('activityDetailLocationMappings')
            .where('value')
            .equals(value)
            .first();
    }

    /**
     * Get location for a specific activity detail value
     * Returns the full Location object if found, undefined otherwise
     */
    async getLocationForValue(
        value: string | number
    ): Promise<Location | undefined> {
        try {
            const mapping = await this.getMappingByValue(value);
            if (!mapping || !mapping.locationId) return undefined;
            return await locationDao.getLocationById(mapping.locationId);
        } catch (error) {
            console.error('Error getting location for value:', value, error);
            return undefined;
        }
    }

    /**
     * Create or update a mapping from detail value to location
     */
    async setLocationForValue(
        value: string | number,
        location: Location
    ): Promise<ActivityDetailLocationMapping> {
        // Ensure location exists and get its ID back
        const locationId = await locationDao.saveItem(location);

        // Check if mapping already exists
        const existing = await this.getMappingByValue(value);
        if (existing) {
            // Update existing mapping
            const updated: ActivityDetailLocationMapping = {
                ...existing,
                locationId: locationId as string,
            };
            await this.saveItem(updated);
            return updated;
        } else {
            // Create new mapping
            const mapping: ActivityDetailLocationMapping = {
                id: crypto.randomUUID
                    ? crypto.randomUUID()
                    : Math.random().toString(),
                value,
                locationId: locationId as string,
            };
            await this.saveItem(mapping);
            return mapping;
        }
    }

    /**
     * Remove location mapping for a detail value
     */
    async removeMappingForValue(value: string | number): Promise<void> {
        const mapping = await this.getMappingByValue(value);
        if (mapping) {
            await db.table('activityDetailLocationMappings').delete(mapping.id);
        }
    }
}

export const activityDetailLocationMappingDao =
    new ActivityDetailLocationMappingDao();
