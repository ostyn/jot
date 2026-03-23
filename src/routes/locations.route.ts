import {
    css,
    html,
    LitElement,
    nothing,
    PropertyValueMap,
    unsafeCSS,
} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import {
    map as createMap,
    Map as MapType,
    marker,
    Marker,
    tileLayer,
} from 'leaflet';
import { base } from '../baseStyles';
import { activityDetailLocationMappingDao } from '../dao/ActivityDetailLocationMappingDao';
import { locationDao } from '../dao/LocationDao';
import { Location } from '../interfaces/entry.interface';
import { entries } from '../stores/entries.store';
import { DateHelpers } from '../utils/DateHelpers';
import { go } from './route-config';
import leaflet from '/node_modules/leaflet/dist/leaflet.css?inline';

type LocationWithUsage = Location & {
    usageCount: number;
    entryDates: string[];
};

@customElement('locations-route')
export class LocationsRoute extends LitElement {
    @state()
    locationsWithUsage: LocationWithUsage[] = [];
    @state()
    isLoading = true;
    @state()
    selectedLocation?: LocationWithUsage;
    @state()
    showEntries = false;

    map?: MapType;
    mapContainer: Ref<HTMLElement> = createRef();
    markers: Map<string, Marker> = new Map();

    async connectedCallback() {
        super.connectedCallback();
        await this.loadLocations();
    }

    protected async firstUpdated(
        _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
    ) {
        this.setupMap();
    }

    private async loadLocations() {
        this.isLoading = true;
        try {
            // Get all location mappings
            const mappings = await activityDetailLocationMappingDao.getItems();
            console.log(
                '[Locations] Mappings found:',
                mappings.length,
                mappings
            );

            // Get unique locationIds
            const locationIds = [...new Set(mappings.map((m) => m.locationId))];
            console.log('[Locations] Location IDs from mappings:', locationIds);

            // Get all locations
            const allLocations = await locationDao.getItems();
            console.log(
                '[Locations] All locations in DB:',
                allLocations.map((l) => ({ id: l.id, name: l.name }))
            );
            const locationsMap = new Map(
                allLocations.map((loc) => [loc.id, loc])
            );
            console.log(
                '[Locations] Locations map keys:',
                Array.from(locationsMap.keys())
            );

            // For each location, find which entries use activity details that reference it
            const locationsWithUsage: LocationWithUsage[] = [];

            for (const locationId of locationIds) {
                const location = locationsMap.get(locationId);
                if (!location) {
                    console.warn(
                        '[Locations] Location not found for ID:',
                        locationId
                    );
                    continue;
                }

                // Find all detail values that map to this location
                const detailValuesForLocation = mappings
                    .filter((m) => m.locationId === locationId)
                    .map((m) => m.value);
                console.log(
                    '[Locations] Detail values for',
                    location.name,
                    ':',
                    detailValuesForLocation
                );

                // Find all entries that use these detail values
                const entryDatesSet = new Set<string>();
                console.log(
                    '[Locations] Searching',
                    entries.all.length,
                    'entries'
                );
                for (const entry of entries.all) {
                    for (const activityDetail of Object.values(
                        entry.activities
                    )) {
                        const detailArray = Array.isArray(activityDetail)
                            ? activityDetail
                            : [activityDetail];
                        const hasMatch = detailArray.some((detail) =>
                            detailValuesForLocation.includes(detail as any)
                        );
                        if (hasMatch) {
                            console.log(
                                '[Locations] Found match in entry',
                                entry.date
                            );
                            entryDatesSet.add(entry.date);
                        }
                    }
                }

                locationsWithUsage.push({
                    ...location,
                    usageCount: entryDatesSet.size,
                    entryDates: Array.from(entryDatesSet).sort().reverse(),
                });
            }

            // Sort by usage count
            locationsWithUsage.sort((a, b) => b.usageCount - a.usageCount);
            this.locationsWithUsage = locationsWithUsage;
            console.log(
                '[Locations] Final locations with usage:',
                locationsWithUsage
            );
        } catch (error) {
            console.error('Error loading locations:', error);
        } finally {
            this.isLoading = false;
        }
    }

    private setupMap() {
        if (!this.mapContainer.value || this.locationsWithUsage.length === 0)
            return;

        // Create map centered on first location
        const firstLoc = this.locationsWithUsage[0];
        this.map = createMap(this.mapContainer.value, {
            attributionControl: false,
        }).setView([firstLoc.lat, firstLoc.lng], 10);

        tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
            this.map
        );

        // Add markers for all locations
        for (const loc of this.locationsWithUsage) {
            const m = marker([loc.lat, loc.lng], {
                title: `${loc.name} (${loc.usageCount})`,
            })
                .addTo(this.map)
                .on('click', () => {
                    this.selectedLocation = loc;
                    this.showEntries = true;
                });

            this.markers.set(loc.id, m);

            // Add popup
            m.bindPopup(
                `<div class="location-popup"><strong>${loc.name}</strong><br/><small>Used ${loc.usageCount} times</small></div>`
            );
        }

        // Fit all markers in view
        const bounds = this.locationsWithUsage.map((l) => [l.lat, l.lng]);
        if (bounds.length > 0) {
            this.map.fitBounds(bounds as any, { padding: [50, 50] });
        }
    }

    private navigateToEntry(date: string) {
        const parts = DateHelpers.getDateStringParts(date);
        go('entries', { queryParams: parts });
    }

    render() {
        if (this.isLoading) {
            return html`<article>
                <span aria-busy="true">Loading locations...</span>
            </article>`;
        }

        return html`<article class="locations-container">
            <header>
                <h1>Locations Map (${this.locationsWithUsage.length})</h1>
            </header>

            <div class="map-wrapper">
                <div
                    id="map"
                    ${ref(this.mapContainer)}
                    class="locations-map"
                ></div>

                ${this.showEntries && this.selectedLocation
                    ? html`<div class="entries-panel">
                          <div class="entries-panel-header">
                              <h3>${this.selectedLocation.name}</h3>
                              <button
                                  class="close-button"
                                  @click=${() => (this.showEntries = false)}
                              >
                                  ✕
                              </button>
                          </div>
                          <div class="entries-list">
                              ${this.selectedLocation.entryDates.map(
                                  (date) => html`
                                      <button
                                          class="entry-item"
                                          @click=${() =>
                                              this.navigateToEntry(date)}
                                      >
                                          ${date}
                                      </button>
                                  `
                              )}
                          </div>
                      </div>`
                    : nothing}
            </div>
        </article>`;
    }

    static styles = [
        base,
        unsafeCSS(leaflet),
        css`
            .locations-container {
                display: flex;
                flex-direction: column;
                height: 100vh;
                padding: 0;
            }

            header {
                padding: 16px;
                border-bottom: 1px solid var(--form-element-border-color);
            }

            header h1 {
                margin: 0;
            }

            .map-wrapper {
                flex: 1;
                position: relative;
                overflow: hidden;
            }

            .locations-map {
                width: 100%;
                height: 100%;
            }

            .entries-panel {
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                background-color: var(--pico-background-color);
                border-top: 2px solid var(--pico-color);
                border-radius: 8px 8px 0 0;
                max-height: 50%;
                overflow-y: auto;
                box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
                z-index: 10;
            }

            .entries-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                border-bottom: 1px solid var(--form-element-border-color);
                gap: 8px;
            }

            .entries-panel-header h3 {
                margin: 0;
                flex: 1;
            }

            .close-button {
                background: none;
                border: none;
                font-size: 1.5em;
                cursor: pointer;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }

            .close-button:hover {
                opacity: 0.7;
            }

            .entries-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 12px 16px;
            }

            .entry-item {
                padding: 8px 12px;
                background-color: rgba(59, 130, 246, 0.1);
                border: 1px solid rgba(59, 130, 246, 0.3);
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.9em;
                transition: all 0.2s;
            }

            .entry-item:hover {
                background-color: rgba(59, 130, 246, 0.2);
                border-color: rgba(59, 130, 246, 0.5);
            }
        `,
    ];
}
