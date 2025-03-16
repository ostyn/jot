import { css, html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { format } from 'date-fns';
import { base } from '../baseStyles';
import { DateHelpers } from '../utils/DateHelpers';
import { Sheet } from './action-sheets/action-sheet';
import { MapSheet } from './action-sheets/map.sheet';

export interface Station {
    id: string; // Unique identifier for the station
    name: string; // Name of the station
    terminalName: string; // Terminal name associated with the station
    lat: number; // Latitude of the station
    long: number; // Longitude of the station
    installed: boolean; // Indicates whether the station is installed
    locked: boolean; // Indicates whether the station is locked
    installDate?: Date; // Installation date as a timestamp
    removalDate?: Date; // Removal date (optional, as it can be empty)
    temporary: boolean; // Indicates whether the station is temporary
    nbBikes: number; // Total number of bikes available
    nbStandardBikes: number; // Number of standard bikes available
    nbEBikes: number; // Number of electric bikes available
    nbEmptyDocks: number; // Number of empty docks at the station
    nbDocks: number; // Total number of docks at the station
    isFavorite: boolean;
    distanceFromUser: number;
}

@customElement('station-component')
export class StationComponent extends LitElement {
    static styles = [
        base,
        css`
            .station {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .tag {
                padding: 0.2rem 0.4rem;
                background-color: var(--pico-color);
                color: var(--pico-background-color);
                border-radius: 9999px;
                font-size: 0.75rem;
            }
            meter {
                width: 50%;
            }
            meter::after {
                content: attr(value) ' ' attr(title);
                top: -22px;
                left: calc(100% + 20px);
                position: relative;
            }
        `,
    ];

    @property({ type: Object }) station!: Station;

    render() {
        return html`
            <article
                @click="${() => {
                    Sheet.open({
                        type: MapSheet,
                        data: { lat: this.station.lat, lon: this.station.long },
                    });
                }}"
            >
                <header class="station">
                    <span>
                        ${this.station.name}
                        ${this.station.distanceFromUser &&
                        html` <span class="tag"
                            >${this.station.distanceFromUser?.toFixed(2)}
                            mi</span
                        >`}
                    </span>
                    <button @click="${this.toggleFavorite}">
                        <jot-icon
                            name="Heart"
                            fillColor="${this.station.isFavorite
                                ? 'white'
                                : ''}"
                        ></jot-icon>
                    </button>
                </header>
                <section class="station-details">
                    <meter
                        title="bikes"
                        id="fuel"
                        min="0"
                        max="${this.station.nbDocks - this.station.nbEBikes}"
                        low="4"
                        value="${this.station.nbStandardBikes}"
                    ></meter>
                    ${this.station.installDate &&
                    this.itsYourBirthday(this.station.installDate)
                        ? html`<p>
                              Happy Birthday! 🎂🥳🎈:
                              ${DateHelpers.dateToStringDate(
                                  this.station.installDate
                              )}
                          </p>`
                        : nothing}
                </section>
            </article>
        `;
    }

    private itsYourBirthday(birthday: Date) {
        const now = new Date();
        return format(now, 'MM-dd') === format(birthday, 'MM-dd');
    }

    private toggleFavorite(event: Event) {
        event.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('favorite-toggle', {
                detail: { station: this.station },
                bubbles: true,
                composed: true,
            })
        );
    }
}
