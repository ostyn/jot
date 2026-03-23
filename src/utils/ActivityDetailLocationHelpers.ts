import { activityDetailLocationMappingDao } from '../dao/ActivityDetailLocationMappingDao';
import {
    ActivityDetail,
    ActivityDetailLocationMapping,
    Location,
} from '../interfaces/entry.interface';

/**
 * Helper utilities for working with activity details and their location mappings
 */

/**
 * Extract scalar values from an activity detail
 * Handles both single values (number, string) and arrays of values
 */
export function extractDetailValues(
    detail: ActivityDetail
): (string | number)[] {
    if (Array.isArray(detail)) {
        return detail as (string | number)[];
    }
    return [detail as string | number];
}

/**
 * Get location for a single activity detail value
 * Looks up the mapping and returns the associated Location
 */
export async function getLocationForDetailValue(
    value: string | number
): Promise<Location | undefined> {
    return activityDetailLocationMappingDao.getLocationForValue(value);
}

/**
 * Get locations for all values in an activity detail
 * Returns a map of value -> Location (skipping values without locations)
 */
export async function getLocationsForDetail(
    detail: ActivityDetail
): Promise<Map<string | number, Location>> {
    const values = extractDetailValues(detail);
    const locations = new Map<string | number, Location>();

    for (const value of values) {
        const location = await getLocationForDetailValue(value);
        if (location) {
            locations.set(value, location);
        }
    }

    return locations;
}

/**
 * Associate a location with an activity detail value
 * This creates a persistent mapping that applies retroactively and forward
 */
export async function attachLocationToDetailValue(
    detailValue: string | number,
    location: Location
): Promise<ActivityDetailLocationMapping> {
    return activityDetailLocationMappingDao.setLocationForValue(
        detailValue,
        location
    );
}

/**
 * Remove location association for a detail value
 */
export async function removeLocationForDetailValue(
    detailValue: string | number
): Promise<void> {
    return activityDetailLocationMappingDao.removeMappingForValue(detailValue);
}

/**
 * Get all location mappings (for debugging, migration, etc.)
 */
export async function getAllLocationMappings(): Promise<
    ActivityDetailLocationMapping[]
> {
    return activityDetailLocationMappingDao.getItems();
}

/**
 * Create a new location without a mapping
 * (Useful if you want to create location first, map later)
 */
export async function createLocation(
    name: string,
    lat: number,
    lng: number,
    description?: string,
    country?: string,
    city?: string
): Promise<Location> {
    const location: Location = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(),
        name,
        lat,
        lng,
        description,
        country,
        city,
    };
    return activityDetailLocationMappingDao.saveItem(
        location
    ) as unknown as Location;
}

/**
 * Batch operation: create location and immediately attach to multiple detail values
 * Useful when you discover a location from one activity detail and want to reuse across others
 */
export async function attachLocationToMultipleValues(
    values: (string | number)[],
    location: Location
): Promise<void> {
    for (const value of values) {
        await attachLocationToDetailValue(value, location);
    }
}
