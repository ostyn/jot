import { html, LitElement } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { RouterLocation } from '@vaadin/router';
import '../components/action-sheets/action-sheet-host';
import { ActionSheetHost } from '../components/action-sheets/action-sheet-host';
import { MapSheet } from '../components/action-sheets/map.sheet';
import { Station } from '../components/station.component.ts';
import { stations } from '../stores/stations.store.ts';
import { timer } from '../utils/Helpers.ts';

@customElement('cycle-station-route')
export class CycleStationRoute extends LitElement {
    @state() stationId?: string;
    @state() station?: Station;
    @query('#actionSheetHost') actionSheetHost!: ActionSheetHost;

    async onAfterEnter(location: RouterLocation) {
        if (location.params.id) {
            this.stationId = location.params.id as string;
        }
    }
    // Just to trigger the animation of the sheet closing before navigating away
    async onBeforeLeave(_location: any, _commands: any, _router: any) {
        if (this.actionSheetHost) {
            this.actionSheetHost.setSheetHeight(0);
        }
        await timer(300);
    }

    render() {
        return html`<action-sheet-host id="actionSheetHost"
            >${MapSheet.getActionSheet(
                {
                    lat: stations.getStation(this.stationId as string)?.lat,
                    lng: stations.getStation(this.stationId as string)?.long,
                },
                () => {}
            )}
        </action-sheet-host>`;
    }
}
