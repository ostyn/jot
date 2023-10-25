import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../baseStyles';

@customElement('entries-route')
export class EntriesRoute extends LitElement {
    render() {
        return html`Entries`;
    }
    static styles = [base];
}
