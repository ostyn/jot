import { css, html, LitElement, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
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
            }
            .station input {
                margin-bottom: 0px;
            }
        `,
    ];

    @property({ type: Array }) stations: Station[] = [];
    @state() favoriteIds: string[] = [];
    @state() searchQuery: string = '';
    @state() lat?: number;
    @state() long?: number;

    constructor() {
        super();
        if (localStorage.getItem('favoriteIds')) {
            this.favoriteIds = JSON.parse(
                localStorage.getItem('favoriteIds') as string
            );
        }
    }

    async fetchStations(): Promise<void> {
        try {
            const response = await fetch(
                'https://tfl.gov.uk/tfl/syndication/feeds/cycle-hire/livecyclehireupdates.xml'
            );
            const xml = await response.text();
            this.stations = xmlToJson(xml).stations.station;
            this.stations.forEach((station) => {
                if (this.favoriteIds.includes(station.id)) {
                    station.isFavorite = true;
                }
            });
        } catch (error) {
            console.error('Error fetching stations:', error);
        }
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
        this.sort();

        navigator.geolocation.watchPosition((location) => {
            this.lat = location.coords.latitude;
            this.long = location.coords.longitude;
            this.stations.forEach((station) => {
                station.distanceFromUser = this.getDistanceFromCoordinates(
                    this.lat as number,
                    this.long as number,
                    station.lat,
                    station.long,
                    'miles'
                );
            });
            this.sort();
        });
    }

    private sort() {
        this.stations.sort((a, b) => {
            return (
                ~~b.isFavorite - ~~a.isFavorite ||
                a.distanceFromUser - b.distanceFromUser
            );
        });
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
        this.sort();
        this.requestUpdate();
    }

    render(): TemplateResult {
        const filteredStations: Station[] = this.stations.filter((station) =>
            station.name.toLowerCase().includes(this.searchQuery)
        );

        return html`
            <article class="header">
                <header class="station">
                    <input
                        type="text"
                        @input="${this.updateSearch}"
                        placeholder="Search stations..."
                    />
                    <button @click="${() => this.fetchStations()}">
                        <jot-icon name="RefreshCw"></jot-icon>
                    </button>
                </header>
            </article>

            <div class="stations">
                ${filteredStations.map(
                    (station: Station) => html`
                        <station-component
                            .station="${station}"
                            @favorite-toggle="${this.handleFavoriteToggle}"
                        ></station-component>
                    `
                )}
            </div>
        `;
    }
}
