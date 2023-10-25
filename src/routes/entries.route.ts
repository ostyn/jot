import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import * as data from '../assets/data.json';
import { base } from '../baseStyles';
import '../components/entry.component';
import { Entry } from '../interfaces/entry.interface';

@customElement('entries-route')
export class EntriesRoute extends LitElement {
    entries: Entry[] = data.entries as unknown as Entry[];
    render() {
        return html`${this.entries.map(
            (entry) =>
                html`<entry-component .entry="${entry}"></entry-component>`
        )} `;
    }
    static styles = [base];
}
