import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { RouterLocation } from '@vaadin/router';
import { MapSheet } from '../components/action-sheets/map.sheet';
import { Station } from '../components/station.component.ts';
import { stations } from '../stores/stations.store.ts';
import { AbstractSheetRoute } from './AbstractSheetRoute.ts';

@customElement('cycle-station-route')
export class CycleStationRoute extends AbstractSheetRoute {
    @state() stationId?: string;
    @state() station?: Station;

    async onAfterEnter(location: RouterLocation) {
        if (location.params.id) {
            this.stationId = location.params.id as string;
        }
    }
    renderSheetContent() {
        return html`${MapSheet.getActionSheet(
            {
                lat: stations.getStation(this.stationId as string)?.lat,
                lon: stations.getStation(this.stationId as string)?.long,
            },
            () => {}
        )}`;
    }
}
