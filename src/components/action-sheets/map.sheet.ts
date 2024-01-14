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
import { circle, map as createMap, Map as MapType, tileLayer } from 'leaflet';
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
    static getActionSheet(
        data: any,
        submit: (data: any) => void
    ): TemplateResult {
        console.log(data);
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
            navigator.geolocation.getCurrentPosition((location) => {
                this.lat = location.coords.latitude;
                this.lon = location.coords.longitude;
                this.setupMap(this.lat, this.lon);
            });
        } else {
            this.setupMap(this.lat, this.lon);
        }
    }
    private setupMap(lat: number, lon: number) {
        const mapEl = (this.shadowRoot?.querySelector('#map') ||
            this) as HTMLElement;
        this.map = createMap(mapEl).setView([lat, lon], 16);
        let circle2 = circle(this.map.getCenter(), {
            color: 'blue',
            opacity: 0.1,
            fillColor: 'blue',
            fillOpacity: 0.3,
            radius: 1,
        }).addTo(this.map);
        let circle3 = circle(this.map.getCenter(), {
            color: 'blue',
            opacity: 0.1,
            fillColor: 'blue',
            fillOpacity: 0.3,
            radius: 50,
        }).addTo(this.map);
        tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(
            this.map
        );
        console.log(this.updatable);
        if (this.updatable) {
            this.map.on('click', (e) => {
                circle2.setLatLng(e.latlng);
                circle3.setLatLng(e.latlng);
                this.lat = e.latlng.lat;
                this.lon = e.latlng.lng;
            });
        }
        const resizeObserver = new ResizeObserver(() => {
            this.map.invalidateSize();
        });
        resizeObserver.observe(this);
    }

    async disconnectedCallback() {
        // Was getting multiple of these
        if (!this.hasDisconnected) {
            this.hasDisconnected = true;
            let resp = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${this.lat}&lon=${this.lon}&format=json`
            );
            let data = await resp.json();
            console.log(data);
            dispatchEvent(this, Events.mapSheetDismissed, {
                lat: this.lat,
                lon: this.lon,
            });
        }
    }
    render() {
        return html` <div id="map"></div> `;
    }
    static styles = [
        unsafeCSS(leaflet),
        css`
            :host {
                height: 100%;
            }
            #map {
                height: 100%;
                width: 100%;
            }
        `,
    ];
}
