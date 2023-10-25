import { html, LitElement, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { base } from '../baseStyles';
import { Entry } from '../interfaces/entry.interface';

@customElement('entry-component')
export class EntryComponent extends LitElement {
    @property()
    public entry: Entry = {} as Entry;
    render() {
        if (!this.entry) return nothing;
        return html`<div>${this.entry.date} ${this.entry.note}</div>`;
    }
    static styles = [base];
}
