import { css, html, LitElement, nothing, TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@lit-labs/virtualizer';
import { base } from '../baseStyles';
import '../components/station.component';
import { Station } from '../components/station.component';
import { xmlToJson } from '../utils/Helpers';

@customElement('cycle-route')
export class CycleRoute extends LitElement {
    static styles = [
        base,
        css`
            .header {
                padding-bottom: 0;
            }
            .station {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }
            .station input {
                margin-bottom: 0px;
            }
            station-component {
                width: 100%;
            }
        `,
    ];

    @state() stations: Station[] = [];
    @state() favoriteIds: string[] = [];
    @state() searchQuery: string = '';
    @state() lat?: number;
    @state() long?: number;
    locationWatcher?: number;
    @state() loading: boolean = false;

    constructor() {
        super();
        if (localStorage.getItem('favoriteIds')) {
            this.favoriteIds = JSON.parse(
                localStorage.getItem('favoriteIds') as string
            );
        }
    }

    async fetchStations(): Promise<void> {
        this.loading = true;
        try {
            const response = await fetch(
                'https://tfl.gov.uk/tfl/syndication/feeds/cycle-hire/livecyclehireupdates.xml'
            );
            const xml = await response.text();
            const resp: Station[] = xmlToJson(xml).stations.station;
            resp.forEach((station) => {
                if (this.favoriteIds.includes(station.id)) {
                    station.isFavorite = true;
                }
                if (station.installDate)
                    station.installDate = new Date(
                        Number.parseInt(
                            station.installDate as unknown as string
                        )
                    );
                if (station.removalDate)
                    station.removalDate = new Date(
                        Number.parseInt(
                            station.removalDate as unknown as string
                        )
                    );
            });

            this.stations = resp;
            this.setDistanceOnStations();
        } catch (error) {
            console.error('Error fetching stations:', error);
        }
        this.loading = false;
    }

    updateSearch(e: InputEvent): void {
        const input = e.target as HTMLInputElement;
        this.searchQuery = input.value.toLowerCase();
    }

    addToFavorites(station: Station): void {
        if (!this.favoriteIds.find((fav) => fav === station.id)) {
            station.isFavorite = true;

            this.favoriteIds.push(station.id);
            localStorage.setItem(
                'favoriteIds',
                JSON.stringify(this.favoriteIds)
            );
        }
    }

    removeFromFavorites(station: Station): void {
        station.isFavorite = false;

        this.favoriteIds = this.favoriteIds.filter((id) => id !== station.id);
        localStorage.setItem('favoriteIds', JSON.stringify(this.favoriteIds));
    }

    async onAfterEnter() {
        await this.fetchStations();
        if (this.locationWatcher)
            navigator.geolocation.clearWatch(this.locationWatcher);
        this.locationWatcher = navigator.geolocation.watchPosition(
            (location) => {
                this.lat = location.coords.latitude;
                this.long = location.coords.longitude;
                this.setDistanceOnStations();
            }
        );
    }

    private setDistanceOnStations() {
        if (this.lat && this.long) {
            this.stations.forEach((station) => {
                station.distanceFromUser = this.getDistanceFromCoordinates(
                    this.lat as number,
                    this.long as number,
                    station.lat,
                    station.long,
                    'miles'
                );
            });
            this.sort(this.stations);
        }
    }

    private sort(stations: Station[]) {
        stations.sort((a, b) => {
            return (
                ~~b.isFavorite - ~~a.isFavorite ||
                a.distanceFromUser - b.distanceFromUser
            );
        });
        this.requestUpdate();
    }

    getDistanceFromCoordinates(
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number,
        unit: 'km' | 'miles' = 'km'
    ): number {
        const toRadians = (degree: number): number => (degree * Math.PI) / 180;

        const R = unit === 'miles' ? 3958.8 : 6371;
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(lat1)) *
                Math.cos(toRadians(lat2)) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    handleFavoriteToggle(e: CustomEvent): void {
        const { station } = e.detail;
        if (this.favoriteIds.includes(station.id)) {
            this.removeFromFavorites(station);
        } else {
            this.addToFavorites(station);
        }
        this.sort(this.stations);
    }

    render(): TemplateResult {
        const filteredStations: Station[] = this.stations.filter((station) =>
            station.name.toLowerCase().includes(this.searchQuery)
        );

        return html`
            <article class="header">
                <header class="station">
                    <input
                        type="search"
                        @input="${this.updateSearch}"
                        placeholder="Search stations..."
                    />
                    <button
                        aria-busy="${this.loading}"
                        @click="${this.fetchStations}"
                    >
                        ${!this.loading
                            ? html`<jot-icon name="RefreshCw"></jot-icon>`
                            : nothing}
                    </button>
                </header>
            </article>

            <div class="stations">
                <lit-virtualizer
                    .items=${filteredStations}
                    .renderItem=${(station: Station): TemplateResult =>
                        html`<station-component
                            .station="${station}"
                            .distanceFromUser="${station.distanceFromUser}"
                            .isFavorite="${station.isFavorite}"
                            @favorite-toggle="${this.handleFavoriteToggle.bind(
                                this
                            )}"
                        ></station-component>`}
                ></lit-virtualizer>
            </div>
        `;
    }
}
