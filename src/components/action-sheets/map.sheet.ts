import {
    css,
    html,
    LitElement,
    nothing,
    PropertyValueMap,
    TemplateResult,
    unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
    Circle,
    circle,
    map as createMap,
    LatLng,
    Map as MapType,
    tileLayer,
} from 'leaflet';
import { base } from '../../baseStyles';
import { locationService } from '../../services/location.service';
import { dispatchEvent, Events } from '../../utils/Helpers';
import leaflet from '/node_modules/leaflet/dist/leaflet.css?inline';

@customElement('map-sheet')
export class MapSheet extends LitElement {
    @property()
    public lat?: number;
    @property()
    public lon?: number;
    @property()
    public updatable?: boolean = false;
    hasDisconnected = false;
    map!: MapType;
    circle2!: Circle;
    circle3!: Circle;
    currentLocation1!: Circle;
    currentLocation2!: Circle;
    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        return html`<map-sheet
            @mapSheetDismissed=${(e: any) => submit(e.detail)}
            lat=${data?.lat || nothing}
            lon=${data?.lon || nothing}
            updatable=${data?.updatable || nothing}
        ></map-sheet>`;
    }
    protected firstUpdated(
        _changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>
    ): void {
        if (!this.lat || !this.lon) {
            const latLng = locationService.getCachedLocation();
            this.setupMap(latLng!.latitude, latLng!.longitude);
        } else {
            this.setupMap(this.lat, this.lon);
        }
    }
    private setupMap(lat: number, lon: number) {
        const mapEl = (this.shadowRoot?.querySelector('#map') ||
            this) as HTMLElement;
        this.map = createMap(mapEl, {
            attributionControl: false,
        }).setView([lat, lon], 16);
        this.circle2 = circle(this.map.getCenter(), {
            color: 'red',
            opacity: 0.1,
            fillColor: 'red',
            fillOpacity: 0.3,
            radius: 1,
        }).addTo(this.map);
        this.circle3 = circle(this.map.getCenter(), {
            color: 'red',
            opacity: 0.1,
            fillColor: 'red',
            fillOpacity: 0.3,
            radius: 50,
        }).addTo(this.map);
        tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
            this.map
        );
        if (this.updatable) {
            this.map.on('click', (e) => {
                this.lat = e.latlng.lat;
                this.lon = e.latlng.lng;
                this.updateMarker();
            });
        }
        const resizeObserver = new ResizeObserver(() => {
            this.map.invalidateSize();
        });
        resizeObserver.observe(this);

        const latLng = new LatLng(0, 0);
        this.currentLocation1 = circle(latLng, {
            color: 'blue',
            opacity: 0.1,
            fillColor: 'blue',
            fillOpacity: 0.3,
            radius: 1,
        }).addTo(this.map);
        this.currentLocation2 = circle(latLng, {
            color: 'blue',
            opacity: 0.1,
            fillColor: 'blue',
            fillOpacity: 0.3,
            radius: 50,
        }).addTo(this.map);
        locationService.subscribe(() => {
            this.updateCurrentLocationMarker();
        });
        this.map.on('zoomend', () => {
            this.updateCircleRadius();
        });
        this.updateCircleRadius();
    }
    private getScaledRadius(): number {
        const zoom = this.map.getZoom();
        // Base radius at zoom level 16
        const baseZoom = 16;
        const baseRadius = 50; // meters

        // Scale exponentially or linearly depending on preference
        const scale = Math.pow(2, baseZoom - zoom);
        return Math.max(10, baseRadius * scale); // clamp to minimum radius
    }
    private updateCircleRadius() {
        const scaledRadius = this.getScaledRadius();
        this.circle2.setRadius(scaledRadius * 0.02); // smaller inner ring
        this.circle3.setRadius(scaledRadius); // outer ring

        this.currentLocation1.setRadius(scaledRadius * 0.02);
        this.currentLocation2.setRadius(scaledRadius);
    }

    async disconnectedCallback() {
        // Was getting multiple of these
        if (!this.hasDisconnected) {
            this.hasDisconnected = true;
            // if (this.updatable) {
            //     let resp = await fetch(
            //         `https://nominatim.openstreetmap.org/reverse?lat=${this.lat}&lon=${this.lon}&format=json`
            //     );
            //     let data = await resp.json();
            //     console.log(data);
            // }
            dispatchEvent(this, Events.mapSheetDismissed, {
                lat: this.lat,
                lon: this.lon,
            });
        }
    }
    render() {
        return html`
            ${this.updatable
                ? html`<span class="buttons">
                      <button
                          class="inline button"
                          @click=${() =>
                              navigator.geolocation.getCurrentPosition(
                                  (location) => {
                                      this.lat = location.coords.latitude;
                                      this.lon = location.coords.longitude;
                                      this.updateMarker();
                                  }
                              )}
                      >
                          <jot-icon name="Locate"></jot-icon>
                      </button>
                      <button
                          class="inline button secondary"
                          @click=${() => {
                              this.lat = undefined;
                              this.lon = undefined;
                              dispatchEvent(this, Events.mapSheetDismissed);
                          }}
                      >
                          <jot-icon name="Trash2"></jot-icon>
                      </button>
                  </span>`
                : nothing}

            <div id="map"></div>
        `;
    }
    static styles = [
        unsafeCSS(leaflet),

        base,
        css`
            :host {
                height: 100%;
            }
            #map {
                height: 100%;
                width: 100%;
            }
            .buttons {
                position: absolute;
                top: 2.5rem;
                right: 1.5rem;
                z-index: 500;
            }
            .buttons button {
                line-height: 0;
            }
            .leaflet-control-zoom a {
                height: 3rem !important;
                width: 3rem !important;
                display: inline-flex;
                align-items: center;
                place-content: center;
                padding: unset;
            }
        `,
    ];

    private updateMarker() {
        const location = { lat: this.lat, lng: this.lon };
        this.circle2.setLatLng(location as any);
        this.circle3.setLatLng(location as any);
        this.map.panTo(location as any);
    }
    private updateCurrentLocationMarker() {
        const location = {
            lat: locationService.getCachedLocation()?.latitude,
            lng: locationService.getCachedLocation()?.longitude,
        };
        this.currentLocation1.setLatLng(location as any);
        this.currentLocation2.setLatLng(location as any);
        this.map.panTo(location as any);
    }
}
