import { action, makeObservable, observable } from 'mobx';
import { Station } from '../components/station.component';
import { xmlToJson } from '../utils/Helpers';

class StationStore {
    @observable all: Station[] = [];
    @observable loading: boolean = false;

    @action.bound
    setStations(stations: Station[]) {
        this.all = stations;
    }
    constructor() {
        makeObservable(this);      
    }
    async populateStations() {
        this.loading = true;
        try {
            const response = await fetch(
                'https://tfl.gov.uk/tfl/syndication/feeds/cycle-hire/livecyclehireupdates.xml'
            );
            const xml = await response.text();
            const stations: Station[] = xmlToJson(xml).stations.station;
            this.setStations(stations);
        } catch (error) {
            console.error('Error fetching stations:', error);
        } finally {
            this.loading = false;
        }
    }
    getStation(id: string): Station | undefined {
        return this.all.find((station) => station.id === id);
    }
}

export const stations = new StationStore();
