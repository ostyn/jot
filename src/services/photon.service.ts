/**
 * Photon API Service
 * Search for locations by query using Komoot's Photon geocoding API
 * https://photon.komoot.io/
 */

export type PhotonFeature = {
    properties: {
        name: string;
        city?: string;
        country?: string;
        osm_key?: string;
    };
    geometry: {
        coordinates: [number, number]; // [lon, lat]
    };
};

export type PhotonSearchResult = {
    name: string;
    city?: string;
    country?: string;
    lng: number;
    lat: number;
};

class PhotonService {
    private static readonly API_BASE = 'https://photon.komoot.io/api';
    private static readonly DEBOUNCE_MS = 300;
    private debounceTimer?: number;

    /**
     * Search for locations by query string
     */
    async search(query: string, limit = 5): Promise<PhotonSearchResult[]> {
        if (!query.trim()) {
            return [];
        }

        try {
            const params = new URLSearchParams({
                q: query,
                limit: limit.toString(),
            });

            const response = await fetch(
                `${PhotonService.API_BASE}/?${params}`
            );
            if (!response.ok) {
                console.error('Photon API error:', response.statusText);
                return [];
            }

            const data = await response.json();
            return this.transformResults(data.features || []);
        } catch (error) {
            console.error('Photon search failed:', error);
            return [];
        }
    }

    /**
     * Search with debouncing (useful for search input)
     */
    async searchDebounced(
        query: string,
        callback: (results: PhotonSearchResult[]) => void,
        limit = 5
    ): Promise<void> {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = window.setTimeout(async () => {
            const results = await this.search(query, limit);
            callback(results);
        }, PhotonService.DEBOUNCE_MS);
    }

    /**
     * Transform Photon feature to our format
     */
    private transformResults(features: PhotonFeature[]): PhotonSearchResult[] {
        return features.map((feature) => ({
            name: feature.properties.name,
            city: feature.properties.city,
            country: feature.properties.country,
            lng: feature.geometry.coordinates[0],
            lat: feature.geometry.coordinates[1],
        }));
    }
}

export const photonService = new PhotonService();
