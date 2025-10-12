type LocationCallback = (coords: GeolocationCoordinates) => void;

class LocationService {
    private static instance: LocationService;
    private subscribers = new Set<LocationCallback>();
    private lastCoords?: GeolocationCoordinates;
    private watchId?: number;

    private constructor() {}

    static getInstance(): LocationService {
        if (!LocationService.instance) {
            LocationService.instance = new LocationService();
        }
        return LocationService.instance;
    }

    subscribe(callback: LocationCallback): void {
        this.subscribers.add(callback);

        // Immediately notify with cached location if available
        if (this.lastCoords) {
            callback(this.lastCoords);
        }

        // Start watching if not already
        if (this.watchId === undefined) {
            this.watchId = navigator.geolocation.watchPosition(
                (pos) => {
                    this.lastCoords = pos.coords;
                    this.notifySubscribers();
                },
                (err) => console.warn('Location error:', err),
                {
                    enableHighAccuracy: true,
                    maximumAge: 10000,
                    timeout: 10000,
                }
            );
        }
    }

    unsubscribe(callback: LocationCallback): void {
        this.subscribers.delete(callback);

        if (this.subscribers.size === 0 && this.watchId !== undefined) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = undefined;
        }
    }

    getCachedLocation(): GeolocationCoordinates | undefined {
        return this.lastCoords;
    }

    private notifySubscribers(): void {
        if (!this.lastCoords) return;
        for (const cb of this.subscribers) {
            cb(this.lastCoords);
        }
    }
}

export const locationService = LocationService.getInstance();
