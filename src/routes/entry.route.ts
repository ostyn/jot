import { html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { base } from '../baseStyles';

@customElement('entry-route')
export class EntryRoute extends LitElement {
    render() {
        return html`Entry`;
    }
    static styles = [base];
}
