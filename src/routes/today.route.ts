import { LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { RouterLocation } from '@vaadin/router';
import { entryDao } from '../dao/EntryDao';
import { go } from './route-config';

@customElement('today-route')
export class TodayRoute extends LitElement {
    constructor() {
        super();
        this.navigateToTodayEntry();
    }

    private navigateToTodayEntry() {
        entryDao
            .getEntriesFromDate(new Date().toISOString().split('T')[0])
            .then((todaysEntries) => {
                if (todaysEntries.length > 0) {
                    const entryId = todaysEntries[0].id;
                    go('entry', { pathParams: [entryId as string] });
                } else {
                    go('entry');
                }
            });
    }
}
